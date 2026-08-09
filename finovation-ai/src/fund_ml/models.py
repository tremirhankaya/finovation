from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pandas as pd


QUANTILES = (0.10, 0.50, 0.90)


def thread_count() -> int:
    requested = int(os.environ.get("FUND_ML_THREADS", "0"))
    if requested > 0:
        return max(1, requested)
    return max(1, min(12, (os.cpu_count() or 4) - 2))


def numeric_matrix(frame: pd.DataFrame, predictors: list[str]) -> pd.DataFrame:
    matrix = frame[predictors].astype("float32")
    if np.isinf(matrix.to_numpy(copy=False)).any():
        raise RuntimeError("Infinite predictor value encountered")
    return matrix


def fit_lgbm_quantiles(
    train: pd.DataFrame,
    valid: pd.DataFrame,
    predictors: list[str],
    params: dict,
    seed: int,
    model_dir: Path | None = None,
    fixed_iterations: dict[str, int] | None = None,
) -> tuple[np.ndarray, dict[str, int]]:
    import lightgbm as lgb

    x_train = numeric_matrix(train, predictors)
    x_valid = numeric_matrix(valid, predictors)
    y_train = train["absolute_source_log_return"].to_numpy(dtype=float)
    y_valid = valid["absolute_source_log_return"].to_numpy(dtype=float)
    predictions: list[np.ndarray] = []
    iterations: dict[str, int] = {}
    for index, quantile in enumerate(QUANTILES):
        key = f"q{int(quantile * 100):02d}"
        n_estimators = int(
            fixed_iterations[key] if fixed_iterations else params["n_estimators"]
        )
        model = lgb.LGBMRegressor(
            objective="quantile",
            alpha=quantile,
            n_estimators=n_estimators,
            learning_rate=float(params["learning_rate"]),
            num_leaves=int(params["num_leaves"]),
            max_depth=int(params["max_depth"]),
            min_child_samples=int(params["min_child_samples"]),
            subsample=float(params["subsample"]),
            subsample_freq=1,
            colsample_bytree=float(params["colsample_bytree"]),
            reg_alpha=float(params["reg_alpha"]),
            reg_lambda=float(params["reg_lambda"]),
            random_state=seed + index,
            bagging_seed=seed + index,
            feature_fraction_seed=seed + index,
            data_random_seed=seed + index,
            deterministic=True,
            force_col_wise=True,
            n_jobs=thread_count(),
            verbosity=-1,
        )
        callbacks = [lgb.log_evaluation(period=0)]
        fit_kwargs: dict = {}
        if fixed_iterations is None:
            callbacks.append(lgb.early_stopping(100, verbose=False))
            fit_kwargs = {
                "eval_set": [(x_valid, y_valid)],
                "eval_metric": "quantile",
            }
        model.fit(x_train, y_train, callbacks=callbacks, **fit_kwargs)
        best = int(model.best_iteration_ or n_estimators)
        iterations[key] = max(1, best)
        predictions.append(model.predict(x_valid, num_iteration=best))
        if model_dir is not None:
            model_dir.mkdir(parents=True, exist_ok=True)
            model.booster_.save_model(model_dir / f"model_{key}.txt")
    return np.column_stack(predictions), iterations


def fit_final_lgbm_quantiles(
    train: pd.DataFrame,
    predict: pd.DataFrame,
    predictors: list[str],
    params: dict,
    iterations: dict[str, int],
    seed: int,
    model_dir: Path,
) -> np.ndarray:
    import lightgbm as lgb

    x_train = numeric_matrix(train, predictors)
    x_predict = numeric_matrix(predict, predictors)
    y_train = train["absolute_source_log_return"].to_numpy(dtype=float)
    values: list[np.ndarray] = []
    model_dir.mkdir(parents=True, exist_ok=True)
    for index, quantile in enumerate(QUANTILES):
        key = f"q{int(quantile * 100):02d}"
        model = lgb.LGBMRegressor(
            objective="quantile",
            alpha=quantile,
            n_estimators=int(iterations[key]),
            learning_rate=float(params["learning_rate"]),
            num_leaves=int(params["num_leaves"]),
            max_depth=int(params["max_depth"]),
            min_child_samples=int(params["min_child_samples"]),
            subsample=float(params["subsample"]),
            subsample_freq=1,
            colsample_bytree=float(params["colsample_bytree"]),
            reg_alpha=float(params["reg_alpha"]),
            reg_lambda=float(params["reg_lambda"]),
            random_state=seed + index,
            deterministic=True,
            force_col_wise=True,
            n_jobs=thread_count(),
            verbosity=-1,
        )
        model.fit(x_train, y_train)
        values.append(model.predict(x_predict))
        model.booster_.save_model(model_dir / f"model_{key}.txt")
    return np.column_stack(values)


def fit_catboost_multiquantile(
    train: pd.DataFrame,
    valid: pd.DataFrame,
    predictors: list[str],
    params: dict,
    seed: int,
    model_path: Path | None = None,
    fixed_iterations: int | None = None,
) -> tuple[np.ndarray, int]:
    from catboost import CatBoostRegressor

    x_train = numeric_matrix(train, predictors)
    x_valid = numeric_matrix(valid, predictors)
    y_train = train["absolute_source_log_return"].to_numpy(dtype=float)
    y_valid = valid["absolute_source_log_return"].to_numpy(dtype=float)
    iterations = int(fixed_iterations or params["iterations"])
    model = CatBoostRegressor(
        loss_function="MultiQuantile:alpha=0.10,0.50,0.90",
        eval_metric="MultiQuantile:alpha=0.10,0.50,0.90",
        iterations=iterations,
        learning_rate=float(params["learning_rate"]),
        depth=int(params["depth"]),
        l2_leaf_reg=float(params["l2_leaf_reg"]),
        random_strength=0.5,
        bagging_temperature=0.5,
        rsm=0.9,
        random_seed=seed,
        thread_count=thread_count(),
        task_type="CPU",
        allow_writing_files=False,
        verbose=False,
    )
    fit_kwargs: dict = {}
    if fixed_iterations is None:
        fit_kwargs = {
            "eval_set": (x_valid, y_valid),
            "use_best_model": True,
            "early_stopping_rounds": 100,
        }
    model.fit(x_train, y_train, verbose=False, **fit_kwargs)
    prediction = np.asarray(model.predict(x_valid), dtype=float)
    if prediction.ndim == 1:
        prediction = prediction.reshape(-1, 3)
    if prediction.shape != (len(valid), 3):
        raise RuntimeError(f"Unexpected CatBoost prediction shape {prediction.shape}")
    best = int(model.tree_count_)
    if model_path is not None:
        model_path.parent.mkdir(parents=True, exist_ok=True)
        model.save_model(model_path)
    return prediction, best


def fit_final_catboost_multiquantile(
    train: pd.DataFrame,
    predict: pd.DataFrame,
    predictors: list[str],
    params: dict,
    iterations: int,
    seed: int,
    model_path: Path,
) -> np.ndarray:
    from catboost import CatBoostRegressor

    model = CatBoostRegressor(
        loss_function="MultiQuantile:alpha=0.10,0.50,0.90",
        iterations=int(iterations),
        learning_rate=float(params["learning_rate"]),
        depth=int(params["depth"]),
        l2_leaf_reg=float(params["l2_leaf_reg"]),
        random_strength=0.5,
        bagging_temperature=0.5,
        rsm=0.9,
        random_seed=seed,
        thread_count=thread_count(),
        task_type="CPU",
        allow_writing_files=False,
        verbose=False,
    )
    model.fit(
        numeric_matrix(train, predictors),
        train["absolute_source_log_return"].to_numpy(dtype=float),
        verbose=False,
    )
    prediction = np.asarray(model.predict(numeric_matrix(predict, predictors)), dtype=float)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(model_path)
    return prediction.reshape(len(predict), 3)


def _sorted_rank_frame(frame: pd.DataFrame) -> pd.DataFrame:
    return frame.sort_values(["as_of_date", "instrument_id"]).reset_index(drop=True)


def fit_lgbm_ranker(
    train: pd.DataFrame,
    valid: pd.DataFrame,
    predictors: list[str],
    params: dict,
    seed: int,
    model_path: Path | None = None,
    fixed_iterations: int | None = None,
) -> tuple[pd.DataFrame, int]:
    import lightgbm as lgb

    train = _sorted_rank_frame(train)
    valid = _sorted_rank_frame(valid)
    train_group = train.groupby("as_of_date", sort=False).size().to_numpy()
    valid_group = valid.groupby("as_of_date", sort=False).size().to_numpy()
    n_estimators = int(fixed_iterations or params["n_estimators"])
    model = lgb.LGBMRanker(
        objective="lambdarank",
        metric="ndcg",
        eval_at=[10, 20],
        n_estimators=n_estimators,
        learning_rate=float(params["learning_rate"]),
        num_leaves=int(params["num_leaves"]),
        max_depth=int(params["max_depth"]),
        min_child_samples=int(params["min_child_samples"]),
        subsample=float(params["subsample"]),
        subsample_freq=1,
        colsample_bytree=float(params["colsample_bytree"]),
        reg_alpha=float(params["reg_alpha"]),
        reg_lambda=float(params["reg_lambda"]),
        random_state=seed,
        deterministic=True,
        force_col_wise=True,
        n_jobs=thread_count(),
        verbosity=-1,
    )
    callbacks = [lgb.log_evaluation(period=0)]
    fit_kwargs: dict = {}
    if fixed_iterations is None:
        callbacks.append(lgb.early_stopping(100, verbose=False))
        fit_kwargs = {
            "eval_set": [(numeric_matrix(valid, predictors), valid["relevance"])],
            "eval_group": [valid_group],
            "eval_at": [10, 20],
        }
    model.fit(
        numeric_matrix(train, predictors),
        train["relevance"].to_numpy(dtype=int),
        group=train_group,
        callbacks=callbacks,
        **fit_kwargs,
    )
    best = int(model.best_iteration_ or n_estimators)
    output = valid[
        [
            "instrument_id",
            "as_of_date",
            "horizon_months",
            "label_target_date",
            "absolute_source_log_return",
            "absolute_source_price_return",
            "relevance",
        ]
    ].copy()
    output["rank_score"] = model.predict(
        numeric_matrix(valid, predictors), num_iteration=best
    )
    if model_path is not None:
        model_path.parent.mkdir(parents=True, exist_ok=True)
        model.booster_.save_model(model_path)
    return output, best


def fit_final_lgbm_ranker(
    train: pd.DataFrame,
    predict: pd.DataFrame,
    predictors: list[str],
    params: dict,
    iterations: int,
    seed: int,
    model_path: Path,
) -> np.ndarray:
    import lightgbm as lgb

    train = _sorted_rank_frame(train)
    groups = train.groupby("as_of_date", sort=False).size().to_numpy()
    model = lgb.LGBMRanker(
        objective="lambdarank",
        metric="ndcg",
        eval_at=[10, 20],
        n_estimators=int(iterations),
        learning_rate=float(params["learning_rate"]),
        num_leaves=int(params["num_leaves"]),
        max_depth=int(params["max_depth"]),
        min_child_samples=int(params["min_child_samples"]),
        subsample=float(params["subsample"]),
        subsample_freq=1,
        colsample_bytree=float(params["colsample_bytree"]),
        reg_alpha=float(params["reg_alpha"]),
        reg_lambda=float(params["reg_lambda"]),
        random_state=seed,
        deterministic=True,
        force_col_wise=True,
        n_jobs=thread_count(),
        verbosity=-1,
    )
    model.fit(
        numeric_matrix(train, predictors),
        train["relevance"].to_numpy(dtype=int),
        group=groups,
        callbacks=[lgb.log_evaluation(period=0)],
    )
    model_path.parent.mkdir(parents=True, exist_ok=True)
    model.booster_.save_model(model_path)
    return model.predict(numeric_matrix(predict, predictors))
