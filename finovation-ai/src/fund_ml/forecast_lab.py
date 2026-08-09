from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from fund_ml.data import (
    ProjectPaths,
    TPP_RATE_ONLY,
    development_folds,
    fixed_test_fold,
    load_config,
    load_predictor_contract,
    rebuild_tpp_rate_features,
)
from fund_ml.metrics import constant_quantile_predictions, quantile_metrics
from fund_ml.models import (
    fit_catboost_multiquantile,
    fit_final_catboost_multiquantile,
    numeric_matrix,
    thread_count,
)


IDENTITY = [
    "instrument_id",
    "as_of_date",
    "horizon_months",
    "label_target_date",
    "absolute_source_log_return",
    "absolute_source_price_return",
]

SHORT_EQUITY = [
    "source_log_return_1",
    "source_log_return_5",
    "source_log_return_20",
    "source_log_return_60",
    "source_log_return_126",
    "source_intraday_log_range",
    "source_close_to_open_log_return",
    "source_realized_volatility_20",
    "source_realized_volatility_60",
    "source_downside_volatility_20",
    "source_downside_volatility_60",
    "source_drawdown_from_60_session_peak",
    "cross_section_momentum_20_percentile",
    "cross_section_positive_return_breadth",
    "cross_section_return_dispersion",
    "source_ma5_ma20_ratio",
    "source_close_ma50_ratio",
    "source_rsi_14",
    "source_bollinger_pct_b_20",
    "source_bollinger_bandwidth_20",
    "source_adx_14",
    "source_directional_index_spread_14",
    "source_parkinson_volatility_20",
    "source_overnight_gap_1",
    "source_positive_day_ratio_20",
    "source_max_daily_log_return_20",
    "source_return_skewness_60",
    "source_volatility_ratio_20_60",
    "universe58_loo_log_return_1",
    "universe58_loo_log_return_20",
    "universe58_loo_log_return_60",
    "universe58_loo_log_return_126",
    "universe58_loo_realized_volatility_20",
    "source_beta_universe58_60",
    "source_correlation_universe58_60",
    "source_residual_momentum_20",
    "source_idiosyncratic_volatility_60",
    "cross_section_momentum_126_percentile",
    "cross_section_volatility_60_percentile",
    "cross_section_beta_60_percentile",
]

CATBOOST_BY_HORIZON = {3: "C_BALANCED", 6: "C_SHALLOW", 12: "C_SHALLOW"}
LGBM_NAME = "Q_REGULARIZED"
HUBER_LGBM_NAME = "Q_EXPRESSIVE"
HARD_Q50_MEDIAN_UNIQUE = 10
HARD_Q50_ORIGIN_PASS_RATE = 0.50


@dataclass
class Candidate:
    candidate_id: str
    predictors: list[str]
    table_kind: str
    dev: pd.DataFrame
    holdout: pd.DataFrame
    late: pd.DataFrame | None
    spec: dict[str, Any]


def _prediction_frame(valid: pd.DataFrame, values: np.ndarray, fold_id: str) -> pd.DataFrame:
    output = valid[IDENTITY].copy()
    output["fold_id"] = fold_id
    output["prediction_log_q10"] = values[:, 0]
    output["prediction_log_q50"] = values[:, 1]
    output["prediction_log_q90"] = values[:, 2]
    return output


def _metrics(frame: pd.DataFrame) -> dict[str, Any]:
    result = quantile_metrics(frame)
    if "fold_id" in frame:
        fold_values = []
        for fold_id, part in frame.groupby("fold_id", sort=True):
            fold_values.append({"fold_id": str(fold_id), **quantile_metrics(part)})
        result["fold_metrics"] = fold_values
    return result


def _median_int(values: list[int]) -> int:
    return max(1, int(np.median(np.asarray(values, dtype=int))))


def _lgb_model(
    train: pd.DataFrame,
    valid: pd.DataFrame,
    predictors: list[str],
    params: dict,
    seed: int,
    objective: str,
    target: str = "absolute_source_log_return",
    alpha: float | None = None,
    fixed_iterations: int | None = None,
    model_path: Path | None = None,
) -> tuple[np.ndarray, int]:
    import lightgbm as lgb

    kwargs: dict[str, Any] = {"objective": objective}
    if alpha is not None:
        kwargs["alpha"] = alpha
    n_estimators = int(fixed_iterations or params["n_estimators"])
    model = lgb.LGBMRegressor(
        **kwargs,
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
        bagging_seed=seed,
        feature_fraction_seed=seed,
        data_random_seed=seed,
        deterministic=True,
        force_col_wise=True,
        n_jobs=thread_count(),
        verbosity=-1,
    )
    callbacks = [lgb.log_evaluation(period=0)]
    fit_kwargs: dict[str, Any] = {}
    if fixed_iterations is None:
        callbacks.append(lgb.early_stopping(100, verbose=False))
        fit_kwargs = {
            "eval_set": [(numeric_matrix(valid, predictors), valid[target].to_numpy(float))],
            "eval_metric": "l1" if objective == "huber" else "quantile",
        }
    model.fit(
        numeric_matrix(train, predictors),
        train[target].to_numpy(float),
        callbacks=callbacks,
        **fit_kwargs,
    )
    best = int(model.best_iteration_ or n_estimators)
    prediction = model.predict(numeric_matrix(valid, predictors), num_iteration=best)
    if model_path is not None:
        model_path.parent.mkdir(parents=True, exist_ok=True)
        model.booster_.save_model(model_path)
    return np.asarray(prediction, dtype=float), max(1, best)


def _fit_components(
    train: pd.DataFrame,
    valid: pd.DataFrame,
    predictors: list[str],
    params: dict,
    huber_params: dict,
    seed: int,
    fixed: dict[str, int] | None = None,
    target: str = "absolute_source_log_return",
    model_dir: Path | None = None,
) -> tuple[np.ndarray, np.ndarray, dict[str, int]]:
    predictions: dict[str, np.ndarray] = {}
    iterations: dict[str, int] = {}
    for index, (key, quantile) in enumerate((("q10", 0.10), ("q50", 0.50), ("q90", 0.90))):
        prediction, best = _lgb_model(
            train,
            valid,
            predictors,
            params,
            seed + index,
            "quantile",
            target=target,
            alpha=quantile,
            fixed_iterations=None if fixed is None else int(fixed[key]),
            model_path=None if model_dir is None else model_dir / f"model_{key}.txt",
        )
        predictions[key] = prediction
        iterations[key] = best
    huber, huber_iteration = _lgb_model(
        train,
        valid,
        predictors,
        huber_params,
        seed + 50,
        "huber",
        target=target,
        alpha=0.90,
        fixed_iterations=None if fixed is None else int(fixed["huber"]),
        model_path=None if model_dir is None else model_dir / "model_q50_huber.txt",
    )
    iterations["huber"] = huber_iteration
    quantile_values = np.column_stack(
        [predictions["q10"], predictions["q50"], predictions["q90"]]
    )
    huber_values = np.column_stack([predictions["q10"], huber, predictions["q90"]])
    return quantile_values, huber_values, iterations


def _late_fold(table: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, pd.DataFrame] | None:
    boundary = pd.Timestamp(config["sealed_holdout"]["end"]) + pd.Timedelta(days=1)
    valid = table.loc[table["as_of_date"].ge(boundary)].copy()
    if valid.empty:
        return None
    valid_start = valid["as_of_date"].min()
    train = table.loc[
        table["as_of_date"].lt(valid_start)
        & table["label_target_date"].lt(valid_start)
    ].copy()
    if train.empty:
        return None
    return train, valid


def _run_lgb_variants(
    table: pd.DataFrame,
    predictors: list[str],
    config: dict,
    horizon: int,
    prefix: str,
    table_kind: str,
) -> tuple[Candidate, Candidate]:
    params = config["quantile_candidates"][LGBM_NAME]
    huber_params = config["quantile_candidates"][HUBER_LGBM_NAME]
    quantile_frames: list[pd.DataFrame] = []
    huber_frames: list[pd.DataFrame] = []
    iteration_rows: list[dict[str, int]] = []
    for fold_index, fold in enumerate(development_folds(table, config)):
        quantile, huber, iterations = _fit_components(
            fold.train,
            fold.valid,
            predictors,
            params,
            huber_params,
            int(config["random_seed"]) + horizon * 100 + fold_index,
        )
        quantile_frames.append(_prediction_frame(fold.valid, quantile, fold.fold_id))
        huber_frames.append(_prediction_frame(fold.valid, huber, fold.fold_id))
        iteration_rows.append(iterations)
    fixed = {
        key: _median_int([row[key] for row in iteration_rows])
        for key in ("q10", "q50", "q90", "huber")
    }
    holdout = fixed_test_fold(table, config)
    quantile_values, huber_values, _ = _fit_components(
        holdout.train,
        holdout.valid,
        predictors,
        params,
        huber_params,
        int(config["random_seed"]) + horizon * 1000,
        fixed=fixed,
    )
    late = _late_fold(table, config)
    late_quantile = None
    late_huber = None
    if late is not None:
        late_train, late_valid = late
        q_values, h_values, _ = _fit_components(
            late_train,
            late_valid,
            predictors,
            params,
            huber_params,
            int(config["random_seed"]) + horizon * 2000,
            fixed=fixed,
        )
        late_quantile = _prediction_frame(late_valid, q_values, "LATE_BACKTEST")
        late_huber = _prediction_frame(late_valid, h_values, "LATE_BACKTEST")
    spec = {
        "family": "LIGHTGBM",
        "params_name": LGBM_NAME,
        "q50_huber_params_name": HUBER_LGBM_NAME,
        "fixed_iterations_from_development_only": fixed,
        "holdout_used_for_early_stopping": False,
    }
    return (
        Candidate(
            f"{prefix}_FIXED_ES_QUANTILE",
            predictors,
            table_kind,
            pd.concat(quantile_frames, ignore_index=True),
            _prediction_frame(holdout.valid, quantile_values, holdout.fold_id),
            late_quantile,
            {**spec, "center": "QUANTILE_Q50"},
        ),
        Candidate(
            f"{prefix}_HUBER_Q50",
            predictors,
            table_kind,
            pd.concat(huber_frames, ignore_index=True),
            _prediction_frame(holdout.valid, huber_values, holdout.fold_id),
            late_huber,
            {**spec, "center": "SEPARATE_HUBER_Q50"},
        ),
    )


def _run_catboost(
    table: pd.DataFrame,
    predictors: list[str],
    config: dict,
    horizon: int,
) -> Candidate:
    name = CATBOOST_BY_HORIZON[horizon]
    params = config["catboost_candidates"][name]
    frames: list[pd.DataFrame] = []
    iterations: list[int] = []
    for fold_index, fold in enumerate(development_folds(table, config)):
        values, best = fit_catboost_multiquantile(
            fold.train,
            fold.valid,
            predictors,
            params,
            int(config["random_seed"]) + horizon * 100 + fold_index,
        )
        frames.append(_prediction_frame(fold.valid, values, fold.fold_id))
        iterations.append(best)
    fixed = _median_int(iterations)
    holdout = fixed_test_fold(table, config)
    holdout_values, _ = fit_catboost_multiquantile(
        holdout.train,
        holdout.valid,
        predictors,
        params,
        int(config["random_seed"]) + horizon * 1000,
        fixed_iterations=fixed,
    )
    late_frame = None
    late = _late_fold(table, config)
    if late is not None:
        late_train, late_valid = late
        late_values, _ = fit_catboost_multiquantile(
            late_train,
            late_valid,
            predictors,
            params,
            int(config["random_seed"]) + horizon * 2000,
            fixed_iterations=fixed,
        )
        late_frame = _prediction_frame(late_valid, late_values, "LATE_BACKTEST")
    return Candidate(
        f"CATBOOST_FIXED_ES_{name}",
        predictors,
        "FULL",
        pd.concat(frames, ignore_index=True),
        _prediction_frame(holdout.valid, holdout_values, holdout.fold_id),
        late_frame,
        {
            "family": "CATBOOST",
            "params_name": name,
            "fixed_iterations_from_development_only": fixed,
            "holdout_used_for_early_stopping": False,
        },
    )


def _window_train(train: pd.DataFrame, anchor: pd.Timestamp, years: int | None) -> pd.DataFrame:
    if years is None:
        return train
    start = anchor - pd.DateOffset(years=years)
    selected = train.loc[train["as_of_date"].ge(start)].copy()
    return selected if len(selected) >= 500 else train


def _bagged_prediction(
    train: pd.DataFrame,
    valid: pd.DataFrame,
    predictors: list[str],
    params: dict,
    huber_params: dict,
    fixed: dict[str, int],
    seed: int,
) -> np.ndarray:
    values = []
    anchor = valid["as_of_date"].min()
    for index, years in enumerate((None, 5, 3)):
        part = _window_train(train, anchor, years)
        _, huber, _ = _fit_components(
            part,
            valid,
            predictors,
            params,
            huber_params,
            seed + index * 101,
            fixed=fixed,
        )
        values.append(huber)
    return np.mean(np.stack(values), axis=0)


def _run_rolling_bagging(
    table: pd.DataFrame,
    predictors: list[str],
    config: dict,
    horizon: int,
    base_spec: dict,
) -> Candidate:
    params = config["quantile_candidates"][LGBM_NAME]
    huber_params = config["quantile_candidates"][HUBER_LGBM_NAME]
    fixed = base_spec["fixed_iterations_from_development_only"]
    frames = []
    for fold_index, fold in enumerate(development_folds(table, config)):
        values = _bagged_prediction(
            fold.train,
            fold.valid,
            predictors,
            params,
            huber_params,
            fixed,
            int(config["random_seed"]) + horizon * 500 + fold_index,
        )
        frames.append(_prediction_frame(fold.valid, values, fold.fold_id))
    holdout = fixed_test_fold(table, config)
    holdout_values = _bagged_prediction(
        holdout.train,
        holdout.valid,
        predictors,
        params,
        huber_params,
        fixed,
        int(config["random_seed"]) + horizon * 5000,
    )
    late_frame = None
    late = _late_fold(table, config)
    if late is not None:
        late_train, late_valid = late
        late_values = _bagged_prediction(
            late_train,
            late_valid,
            predictors,
            params,
            huber_params,
            fixed,
            int(config["random_seed"]) + horizon * 6000,
        )
        late_frame = _prediction_frame(late_valid, late_values, "LATE_BACKTEST")
    return Candidate(
        "ROLLING_BAGGED_HUBER_Q50",
        predictors,
        "FULL",
        pd.concat(frames, ignore_index=True),
        _prediction_frame(holdout.valid, holdout_values, holdout.fold_id),
        late_frame,
        {
            "family": "LIGHTGBM_ROLLING_BAG",
            "windows_years": ["EXPANDING", 5, 3],
            "fixed_iterations_from_development_only": fixed,
            "center": "SEPARATE_HUBER_Q50",
        },
    )


def _align_replace_q50(base: pd.DataFrame, q50: pd.DataFrame) -> pd.DataFrame:
    keys = ["instrument_id", "as_of_date", "horizon_months", "label_target_date"]
    replacement = q50[keys + ["prediction_log_q50"]].copy()
    output = base.drop(columns=["prediction_log_q50"]).merge(
        replacement, on=keys, how="inner", validate="one_to_one"
    )
    return output[base.columns]


def _market_table(frame: pd.DataFrame, predictors: list[str]) -> pd.DataFrame:
    aggregated = frame.groupby("as_of_date", sort=True)[predictors].mean().reset_index()
    target = frame.groupby("as_of_date", sort=True)["absolute_source_log_return"].mean()
    aggregated["absolute_source_log_return"] = aggregated["as_of_date"].map(target)
    return aggregated


def _residual_table(frame: pd.DataFrame) -> pd.DataFrame:
    output = frame.copy()
    market = output.groupby("as_of_date")["absolute_source_log_return"].transform("mean")
    output["absolute_source_log_return"] = output["absolute_source_log_return"] - market
    return output


def _two_stage_q50(
    train: pd.DataFrame,
    valid: pd.DataFrame,
    predictors: list[str],
    params: dict,
    seed: int,
    fixed: dict[str, int] | None = None,
) -> tuple[pd.DataFrame, dict[str, int]]:
    market_train = _market_table(train, predictors)
    market_valid = _market_table(valid, predictors)
    residual_train = _residual_table(train)
    residual_valid = _residual_table(valid)
    market_prediction, market_iteration = _lgb_model(
        market_train,
        market_valid,
        predictors,
        params,
        seed,
        "huber",
        alpha=0.90,
        fixed_iterations=None if fixed is None else fixed["market"],
    )
    residual_prediction, residual_iteration = _lgb_model(
        residual_train,
        residual_valid,
        predictors,
        params,
        seed + 1,
        "huber",
        alpha=0.90,
        fixed_iterations=None if fixed is None else fixed["residual"],
    )
    mapping = dict(zip(market_valid["as_of_date"], market_prediction, strict=True))
    output = valid[IDENTITY].copy()
    output["prediction_log_q50"] = (
        valid["as_of_date"].map(mapping).to_numpy(float) + residual_prediction
    )
    return output, {"market": market_iteration, "residual": residual_iteration}


def _run_two_stage(
    table: pd.DataFrame,
    predictors: list[str],
    config: dict,
    horizon: int,
    base: Candidate,
) -> Candidate:
    params = config["quantile_candidates"][HUBER_LGBM_NAME]
    q50_frames = []
    iteration_rows = []
    for fold_index, fold in enumerate(development_folds(table, config)):
        q50, iterations = _two_stage_q50(
            fold.train,
            fold.valid,
            predictors,
            params,
            int(config["random_seed"]) + horizon * 700 + fold_index,
        )
        q50["fold_id"] = fold.fold_id
        q50_frames.append(q50)
        iteration_rows.append(iterations)
    fixed = {
        key: _median_int([row[key] for row in iteration_rows])
        for key in ("market", "residual")
    }
    holdout = fixed_test_fold(table, config)
    holdout_q50, _ = _two_stage_q50(
        holdout.train,
        holdout.valid,
        predictors,
        params,
        int(config["random_seed"]) + horizon * 7000,
        fixed=fixed,
    )
    late_frame = None
    late = _late_fold(table, config)
    if late is not None and base.late is not None:
        late_train, late_valid = late
        late_q50, _ = _two_stage_q50(
            late_train,
            late_valid,
            predictors,
            params,
            int(config["random_seed"]) + horizon * 8000,
            fixed=fixed,
        )
        late_frame = _align_replace_q50(base.late, late_q50)
    return Candidate(
        "UNIVERSE58_RESIDUAL_TWO_STAGE_Q50",
        predictors,
        "FULL",
        _align_replace_q50(base.dev, pd.concat(q50_frames, ignore_index=True)),
        _align_replace_q50(base.holdout, holdout_q50),
        late_frame,
        {
            "family": "UNIVERSE58_MARKET_PLUS_RESIDUAL",
            "interval_source": base.candidate_id,
            "fixed_iterations_from_development_only": fixed,
        },
    )


def _blend(left: pd.DataFrame, right: pd.DataFrame, left_weight: float) -> pd.DataFrame:
    keys = IDENTITY + (["fold_id"] if "fold_id" in left and "fold_id" in right else [])
    prediction_columns = [
        "prediction_log_q10",
        "prediction_log_q50",
        "prediction_log_q90",
    ]
    merged = left[keys + prediction_columns].merge(
        right[keys + prediction_columns],
        on=keys,
        suffixes=("_left", "_right"),
        validate="one_to_one",
    )
    output = merged[keys].copy()
    for column in prediction_columns:
        output[column] = (
            left_weight * merged[f"{column}_left"]
            + (1.0 - left_weight) * merged[f"{column}_right"]
        )
    return output


def _run_ensemble(left: Candidate, right: Candidate) -> Candidate:
    choices = []
    for weight in (0.25, 0.50, 0.75):
        frame = _blend(left.dev, right.dev, weight)
        metrics = quantile_metrics(frame)
        if (
            metrics["core_crossing_rows"] == 0
            and metrics["median_q50_unique_per_origin"] >= HARD_Q50_MEDIAN_UNIQUE
        ):
            score = metrics["mean_pinball"] * (1.0 + metrics["coverage_80_error"])
            choices.append((score, weight, frame))
    if not choices:
        raise RuntimeError("No development-compliant LightGBM/CatBoost blend")
    _, weight, dev = min(choices, key=lambda row: (row[0], row[1]))
    late = None
    if left.late is not None and right.late is not None:
        late = _blend(left.late, right.late, weight)
    return Candidate(
        "LIGHTGBM_CATBOOST_DEV_WEIGHTED_ENSEMBLE",
        left.predictors,
        "FULL",
        dev,
        _blend(left.holdout, right.holdout, weight),
        late,
        {
            "family": "LIGHTGBM_CATBOOST_BLEND",
            "left_candidate": left.candidate_id,
            "right_candidate": right.candidate_id,
            "left_weight_selected_on_development": weight,
            "left_spec": left.spec,
            "right_spec": right.spec,
        },
    )


def _blend_q50(left: pd.DataFrame, right: pd.DataFrame, left_weight: float) -> pd.DataFrame:
    keys = ["instrument_id", "as_of_date", "horizon_months", "label_target_date"]
    right_center = right[keys + ["prediction_log_q50"]].rename(
        columns={"prediction_log_q50": "right_q50"}
    )
    output = left.merge(right_center, on=keys, how="inner", validate="one_to_one")
    output["prediction_log_q50"] = (
        left_weight * output["prediction_log_q50"]
        + (1.0 - left_weight) * output["right_q50"]
    )
    return output.drop(columns="right_q50")[left.columns]


def _empirical_interval_frame(
    train: pd.DataFrame,
    valid: pd.DataFrame,
    q50_frame: pd.DataFrame,
    fold_id: str,
) -> pd.DataFrame:
    frame = constant_quantile_predictions(train, valid)
    frame = _align_replace_q50(frame, q50_frame)
    frame["fold_id"] = fold_id
    return frame


def _run_empirical_interval_blend(
    table: pd.DataFrame,
    config: dict,
    horizon: int,
    two_stage: Candidate,
    rolling: Candidate,
) -> Candidate:
    choices: list[tuple[float, float]] = []
    for weight in (0.50, 0.75, 0.90):
        blended = _blend_q50(two_stage.dev, rolling.dev, weight)
        metrics = quantile_metrics(blended)
        if (
            metrics["median_q50_unique_per_origin"] >= HARD_Q50_MEDIAN_UNIQUE
            and metrics["origins_q50_unique_ge_10_rate"] >= HARD_Q50_ORIGIN_PASS_RATE
        ):
            choices.append((float(metrics["pinball_q50"]), weight))
    if not choices:
        raise RuntimeError("No development-compliant two-stage/rolling q50 blend")
    _, weight = min(choices, key=lambda row: (row[0], row[1]))

    dev_frames = []
    for fold in development_folds(table, config):
        q50 = _blend_q50(
            two_stage.dev.loc[two_stage.dev["fold_id"].eq(fold.fold_id)],
            rolling.dev.loc[rolling.dev["fold_id"].eq(fold.fold_id)],
            weight,
        )
        dev_frames.append(_empirical_interval_frame(fold.train, fold.valid, q50, fold.fold_id))
    holdout = fixed_test_fold(table, config)
    holdout_q50 = _blend_q50(two_stage.holdout, rolling.holdout, weight)
    holdout_frame = _empirical_interval_frame(
        holdout.train, holdout.valid, holdout_q50, holdout.fold_id
    )
    late_frame = None
    late = _late_fold(table, config)
    if late is not None and two_stage.late is not None and rolling.late is not None:
        late_train, late_valid = late
        late_q50 = _blend_q50(two_stage.late, rolling.late, weight)
        late_frame = _empirical_interval_frame(
            late_train, late_valid, late_q50, "LATE_BACKTEST"
        )
    return Candidate(
        "EMPIRICAL_INTERVAL_TWO_STAGE_ROLLING_Q50",
        two_stage.predictors,
        "FULL",
        pd.concat(dev_frames, ignore_index=True),
        holdout_frame,
        late_frame,
        {
            "family": "EMPIRICAL_INTERVAL_WITH_MODEL_Q50_BLEND",
            "two_stage_weight_selected_on_development": weight,
            "two_stage_spec": two_stage.spec,
            "rolling_spec": rolling.spec,
            "intervals": "TRAIN_ONLY_EMPIRICAL_Q10_Q90",
        },
    )


def _build_short_table(root: Path, config: dict, horizon: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    paths = ProjectPaths(root)
    columns = [
        "instrument_id",
        "as_of_date",
        "market_data_through_date",
        "feature_available_from",
        "history_observation_count_from_2017_07",
        "gap_lookback_mask",
        "unresolved_jump_lookback_mask",
    ] + SHORT_EQUITY
    features = pd.read_parquet(paths.features, columns=columns)
    for column in ("as_of_date", "market_data_through_date", "feature_available_from"):
        features[column] = pd.to_datetime(features[column])
    finite = np.isfinite(features[SHORT_EQUITY].to_numpy(float)).all(axis=1)
    features["feature_eligible"] = (
        features["history_observation_count_from_2017_07"].ge(127)
        & ~features["gap_lookback_mask"].astype(bool)
        & ~features["unresolved_jump_lookback_mask"].astype(bool)
        & finite
    )
    features, _ = rebuild_tpp_rate_features(features, paths.tpp_day1)
    labels = pd.read_parquet(paths.labels)
    labels["as_of_date"] = pd.to_datetime(labels["as_of_date"])
    labels["label_target_date"] = pd.to_datetime(labels["label_target_date"])
    selected = labels.loc[
        labels["horizon_months"].eq(horizon)
        & labels["label_target_date"].le(pd.Timestamp(config["label_maturity_cutoff"]))
        & labels["label_eligible"].astype(bool),
        IDENTITY,
    ].copy()
    table = selected.merge(
        features.loc[features["feature_eligible"]],
        on=["instrument_id", "as_of_date"],
        how="inner",
        validate="one_to_one",
    )
    dates = pd.Series(table["as_of_date"].drop_duplicates()).sort_values()
    iso = dates.dt.isocalendar()
    weekly = pd.DataFrame(
        {"date": dates.to_numpy(), "year": iso["year"].to_numpy(), "week": iso["week"].to_numpy()}
    ).groupby(["year", "week"])["date"].max()
    table = table.loc[table["as_of_date"].isin(weekly)].copy()
    counts = table.groupby("as_of_date")["instrument_id"].nunique()
    table = table.loc[
        table["as_of_date"].isin(counts.loc[counts.ge(config["minimum_names_per_origin"])].index)
    ].copy()
    table.sort_values(["as_of_date", "instrument_id"], inplace=True)
    table.reset_index(drop=True, inplace=True)
    inference = features.loc[
        features["as_of_date"].eq(pd.Timestamp(config["forecast_origin"]))
    ].sort_values("instrument_id").reset_index(drop=True)
    if len(inference) != 58 or not inference["feature_eligible"].all():
        raise RuntimeError("Short-history inference contract failed")
    return table, inference


def _candidate_rows(
    candidate: Candidate,
    empirical_holdout: dict[str, Any],
    reference_holdout: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows = []
    split_metrics = {
        "DEVELOPMENT": _metrics(candidate.dev),
        "COMMON_HOLDOUT": _metrics(candidate.holdout),
    }
    if candidate.late is not None:
        split_metrics["LATE_BACKTEST"] = _metrics(candidate.late)
    for split, metrics in split_metrics.items():
        rows.append(
            {
                "candidate_id": candidate.candidate_id,
                "split": split,
                **{k: v for k, v in metrics.items() if k != "fold_metrics"},
            }
        )
    holdout = split_metrics["COMMON_HOLDOUT"]
    q50_hard = bool(
        holdout["median_q50_unique_per_origin"] >= HARD_Q50_MEDIAN_UNIQUE
        and holdout["origins_q50_unique_ge_10_rate"] >= HARD_Q50_ORIGIN_PASS_RATE
        and holdout["core_crossing_rows"] == 0
    )
    distribution = bool(
        holdout["mean_pinball"] <= 1.05 * empirical_holdout["mean_pinball"]
        and holdout["coverage_80_error"] <= 0.12
    )
    interval_preserved = bool(
        holdout["pinball_q10"] <= 1.05 * reference_holdout["pinball_q10"]
        and holdout["pinball_q90"] <= 1.05 * reference_holdout["pinball_q90"]
    )
    late_pass = True
    if "LATE_BACKTEST" in split_metrics:
        late = split_metrics["LATE_BACKTEST"]
        late_pass = bool(
            late["median_q50_unique_per_origin"] >= HARD_Q50_MEDIAN_UNIQUE
            and late["origins_q50_unique_ge_10_rate"] >= HARD_Q50_ORIGIN_PASS_RATE
            and late["core_crossing_rows"] == 0
        )
    gate = {
        "q50_hard_gate": q50_hard,
        "distribution_gate": distribution,
        "q10_q90_preservation_gate": interval_preserved,
        "late_q50_gate": late_pass,
        "eligible": bool(q50_hard and distribution and interval_preserved and late_pass),
    }
    return rows, {"metrics": split_metrics, "gate": gate}


def _empirical_holdout(table: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, dict[str, Any]]:
    fold = fixed_test_fold(table, config)
    frame = constant_quantile_predictions(fold.train, fold.valid)
    frame["fold_id"] = fold.fold_id
    return frame, quantile_metrics(frame)


def _final_lgb_values(
    table: pd.DataFrame,
    inference: pd.DataFrame,
    predictors: list[str],
    config: dict,
    fixed: dict[str, int],
    model_dir: Path,
    huber_center: bool,
    seed: int,
) -> np.ndarray:
    _, huber, _ = _fit_components(
        table,
        inference.assign(absolute_source_log_return=0.0),
        predictors,
        config["quantile_candidates"][LGBM_NAME],
        config["quantile_candidates"][HUBER_LGBM_NAME],
        seed,
        fixed=fixed,
        model_dir=model_dir,
    )
    if huber_center:
        return huber
    # Re-read the quantile center from the just-fitted models without a second fit.
    import lightgbm as lgb

    matrix = numeric_matrix(inference, predictors)
    return np.column_stack(
        [
            lgb.Booster(model_file=str(model_dir / f"model_{key}.txt")).predict(matrix)
            for key in ("q10", "q50", "q90")
        ]
    )


def _final_candidate_values(
    candidate: Candidate,
    full_table: pd.DataFrame,
    short_table: pd.DataFrame,
    full_inference: pd.DataFrame,
    short_inference: pd.DataFrame,
    config: dict,
    horizon: int,
    model_dir: Path,
) -> np.ndarray:
    table = short_table if candidate.table_kind == "SHORT" else full_table
    inference = short_inference if candidate.table_kind == "SHORT" else full_inference
    seed = int(config["random_seed"]) + horizon * 10000
    if candidate.candidate_id.endswith("FIXED_ES_QUANTILE"):
        return _final_lgb_values(
            table,
            inference,
            candidate.predictors,
            config,
            candidate.spec["fixed_iterations_from_development_only"],
            model_dir,
            False,
            seed,
        )
    if candidate.candidate_id.endswith("HUBER_Q50") and "BAGGED" not in candidate.candidate_id:
        return _final_lgb_values(
            table,
            inference,
            candidate.predictors,
            config,
            candidate.spec["fixed_iterations_from_development_only"],
            model_dir,
            True,
            seed,
        )
    if candidate.candidate_id.startswith("CATBOOST"):
        return fit_final_catboost_multiquantile(
            table,
            inference,
            candidate.predictors,
            config["catboost_candidates"][candidate.spec["params_name"]],
            int(candidate.spec["fixed_iterations_from_development_only"]),
            seed,
            model_dir / "model.cbm",
        )
    if candidate.candidate_id == "ROLLING_BAGGED_HUBER_Q50":
        values = []
        anchor = table["as_of_date"].max()
        for index, years in enumerate((None, 5, 3)):
            part = _window_train(table, anchor, years)
            values.append(
                _final_lgb_values(
                    part,
                    inference,
                    candidate.predictors,
                    config,
                    candidate.spec["fixed_iterations_from_development_only"],
                    model_dir / f"member_{index}",
                    True,
                    seed + index * 101,
                )
            )
        return np.mean(np.stack(values), axis=0)
    if candidate.candidate_id == "UNIVERSE58_RESIDUAL_TWO_STAGE_Q50":
        base_fixed = candidate.spec["interval_base_spec"]["fixed_iterations_from_development_only"]
        values = _final_lgb_values(
            full_table,
            full_inference,
            candidate.predictors,
            config,
            base_fixed,
            model_dir / "interval_base",
            True,
            seed,
        )
        market_train = _market_table(full_table, candidate.predictors)
        market_predict = _market_table(
            full_inference.assign(absolute_source_log_return=0.0), candidate.predictors
        )
        residual_train = _residual_table(full_table)
        market, _ = _lgb_model(
            market_train,
            market_predict.assign(absolute_source_log_return=0.0),
            candidate.predictors,
            config["quantile_candidates"][HUBER_LGBM_NAME],
            seed + 500,
            "huber",
            alpha=0.90,
            fixed_iterations=candidate.spec["fixed_iterations_from_development_only"]["market"],
            model_path=model_dir / "market_q50.txt",
        )
        residual, _ = _lgb_model(
            residual_train,
            full_inference.assign(absolute_source_log_return=0.0),
            candidate.predictors,
            config["quantile_candidates"][HUBER_LGBM_NAME],
            seed + 501,
            "huber",
            alpha=0.90,
            fixed_iterations=candidate.spec["fixed_iterations_from_development_only"]["residual"],
            model_path=model_dir / "residual_q50.txt",
        )
        values[:, 1] = float(market[0]) + residual
        return values
    if candidate.candidate_id == "LIGHTGBM_CATBOOST_DEV_WEIGHTED_ENSEMBLE":
        left_spec = candidate.spec["left_spec"]
        left = _final_lgb_values(
            full_table,
            full_inference,
            candidate.predictors,
            config,
            left_spec["fixed_iterations_from_development_only"],
            model_dir / "lightgbm",
            True,
            seed,
        )
        right_spec = candidate.spec["right_spec"]
        right = fit_final_catboost_multiquantile(
            full_table,
            full_inference,
            candidate.predictors,
            config["catboost_candidates"][right_spec["params_name"]],
            int(right_spec["fixed_iterations_from_development_only"]),
            seed + 100,
            model_dir / "catboost" / "model.cbm",
        )
        weight = float(candidate.spec["left_weight_selected_on_development"])
        return weight * left + (1.0 - weight) * right
    if candidate.candidate_id == "EMPIRICAL_INTERVAL_TWO_STAGE_ROLLING_Q50":
        empty = pd.DataFrame()
        two_stage = Candidate(
            "UNIVERSE58_RESIDUAL_TWO_STAGE_Q50",
            candidate.predictors,
            "FULL",
            empty,
            empty,
            None,
            candidate.spec["two_stage_spec"],
        )
        rolling = Candidate(
            "ROLLING_BAGGED_HUBER_Q50",
            candidate.predictors,
            "FULL",
            empty,
            empty,
            None,
            candidate.spec["rolling_spec"],
        )
        two_values = _final_candidate_values(
            two_stage,
            full_table,
            short_table,
            full_inference,
            short_inference,
            config,
            horizon,
            model_dir / "two_stage",
        )
        rolling_values = _final_candidate_values(
            rolling,
            full_table,
            short_table,
            full_inference,
            short_inference,
            config,
            horizon,
            model_dir / "rolling",
        )
        weight = float(candidate.spec["two_stage_weight_selected_on_development"])
        center = weight * two_values[:, 1] + (1.0 - weight) * rolling_values[:, 1]
        target = full_table["absolute_source_log_return"].to_numpy(float)
        values = np.empty((len(full_inference), 3), dtype=float)
        values[:, 0] = float(np.quantile(target, 0.10))
        values[:, 1] = center
        values[:, 2] = float(np.quantile(target, 0.90))
        return values
    raise RuntimeError(f"Unsupported champion {candidate.candidate_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Leakage-free forecast improvement laboratory")
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    config = load_config(ProjectPaths(root))
    contract = load_predictor_contract(ProjectPaths(root))
    source_predictors = list(contract["predictors"])
    full_equity = [name for name in source_predictors if not name.startswith("tpp_")]
    inference_full = pd.read_parquet(root / "data" / "processed" / "inference_features.parquet")
    inference_full["as_of_date"] = pd.to_datetime(inference_full["as_of_date"])
    baseline_forecasts = pd.read_parquet(
        root / "artifacts" / "forecast_bundle_v2" / "equity_forecasts.parquet"
    )
    report_root = root / "reports" / "forecast_lab_v3"
    artifact_root = root / "artifacts" / "forecast_bundle_v3"
    report_root.mkdir(parents=True, exist_ok=True)
    artifact_root.mkdir(parents=True, exist_ok=True)

    all_metric_rows: list[dict[str, Any]] = []
    decisions: list[dict[str, Any]] = []
    final_frames: list[pd.DataFrame] = []
    for horizon in (3, 6, 12):
        print(f"START H{horizon:02d}", flush=True)
        full_table = pd.read_parquet(root / "data" / "processed" / f"training_h{horizon:02d}.parquet")
        for column in ("as_of_date", "label_target_date"):
            full_table[column] = pd.to_datetime(full_table[column])
        selected_feature_set = (
            "RATE_ONLY"
            if horizon == 6
            else "EQUITY_ONLY"
        )
        full_predictors = full_equity + (TPP_RATE_ONLY if selected_feature_set == "RATE_ONLY" else [])
        short_table, short_inference = _build_short_table(root, config, horizon)
        short_predictors = SHORT_EQUITY + (TPP_RATE_ONLY if selected_feature_set == "RATE_ONLY" else [])

        full_fixed, full_huber = _run_lgb_variants(
            full_table, full_predictors, config, horizon, "FULL", "FULL"
        )
        short_fixed, short_huber = _run_lgb_variants(
            short_table, short_predictors, config, horizon, "SHORT", "SHORT"
        )
        catboost = _run_catboost(full_table, full_predictors, config, horizon)
        rolling = _run_rolling_bagging(
            full_table, full_predictors, config, horizon, full_huber.spec
        )
        two_stage = _run_two_stage(
            full_table, full_predictors, config, horizon, full_huber
        )
        two_stage.spec["interval_base_spec"] = full_huber.spec
        ensemble = _run_ensemble(full_huber, catboost)
        empirical_interval_blend = _run_empirical_interval_blend(
            full_table, config, horizon, two_stage, rolling
        )
        candidates = [
            full_fixed,
            full_huber,
            short_fixed,
            short_huber,
            catboost,
            rolling,
            two_stage,
            ensemble,
            empirical_interval_blend,
        ]
        empirical_frame, empirical_metrics = _empirical_holdout(full_table, config)
        reference_metrics = quantile_metrics(full_fixed.holdout)
        candidate_payload: dict[str, Any] = {}
        eligible = []
        horizon_dir = report_root / f"h{horizon:02d}"
        prediction_dir = horizon_dir / "predictions"
        prediction_dir.mkdir(parents=True, exist_ok=True)
        for candidate in candidates:
            rows, payload = _candidate_rows(
                candidate, empirical_metrics, reference_metrics
            )
            for row in rows:
                row["horizon_months"] = horizon
                all_metric_rows.append(row)
            candidate_payload[candidate.candidate_id] = {
                "spec": candidate.spec,
                **payload,
            }
            candidate.dev.to_parquet(
                prediction_dir / f"{candidate.candidate_id}_development.parquet", index=False
            )
            candidate.holdout.to_parquet(
                prediction_dir / f"{candidate.candidate_id}_holdout.parquet", index=False
            )
            if candidate.late is not None:
                candidate.late.to_parquet(
                    prediction_dir / f"{candidate.candidate_id}_late.parquet", index=False
                )
            if payload["gate"]["eligible"]:
                dev = payload["metrics"]["DEVELOPMENT"]
                score = float(dev["mean_pinball"] * (1.0 + dev["coverage_80_error"]))
                eligible.append((score, candidate.candidate_id, candidate))
        if not eligible:
            raise RuntimeError(f"No hard-q50-compliant candidate for {horizon}M")
        _, _, champion = min(eligible, key=lambda row: (row[0], row[1]))
        champion_payload = candidate_payload[champion.candidate_id]
        values = _final_candidate_values(
            champion,
            full_table,
            short_table,
            inference_full,
            short_inference,
            config,
            horizon,
            artifact_root / "models" / f"h{horizon:02d}" / champion.candidate_id,
        )
        crossing = (values[:, 0] > values[:, 1]) | (values[:, 1] > values[:, 2])
        if crossing.any() or pd.Series(values[:, 1]).nunique() < HARD_Q50_MEDIAN_UNIQUE:
            raise RuntimeError(f"Final hard q50/crossing gate failed for {horizon}M")
        old = baseline_forecasts.loc[
            baseline_forecasts["horizon_months"].eq(horizon)
        ].sort_values("instrument_id").reset_index(drop=True)
        frame = old.copy()
        frame["q10"] = values[:, 0]
        frame["q50"] = values[:, 1]
        frame["q90"] = values[:, 2]
        frame["simple_q10"] = np.expm1(values[:, 0])
        frame["simple_q50"] = np.expm1(values[:, 1])
        frame["simple_q90"] = np.expm1(values[:, 2])
        frame["interval_width"] = values[:, 2] - values[:, 0]
        frame["model_artifact_id"] = f"H{horizon:02d}_{champion.candidate_id}"
        frame["calibration_id"] = None
        frame["model_horizon_eligible"] = True
        frame["row_eligible"] = True
        frame["eligibility_reasons"] = "PASS_HARD_Q50_V3"
        frame["raw_core_quantile_crossing"] = False
        final_frames.append(frame)
        decisions.append(
            {
                "horizon_months": horizon,
                "champion_id": champion.candidate_id,
                "table_kind": champion.table_kind,
                "predictor_count": len(champion.predictors),
                "development_metrics": champion_payload["metrics"]["DEVELOPMENT"],
                "holdout_metrics": champion_payload["metrics"]["COMMON_HOLDOUT"],
                "late_metrics": champion_payload["metrics"].get("LATE_BACKTEST"),
                "gate": champion_payload["gate"],
                "spec": champion.spec,
                "final_q50_unique": int(pd.Series(values[:, 1]).nunique()),
                "final_crossing_rows": int(crossing.sum()),
            }
        )
        (horizon_dir / "candidate_results.json").write_text(
            json.dumps(candidate_payload, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"DONE H{horizon:02d} champion={champion.candidate_id}", flush=True)

    forecasts = pd.concat(final_frames, ignore_index=True)
    forecasts.to_parquet(artifact_root / "equity_forecasts.parquet", index=False)
    metrics = pd.DataFrame(all_metric_rows)
    metrics.to_csv(report_root / "all_candidate_metrics.csv", index=False)
    manifest = {
        "schema_version": "EQUITY_FORECAST_BUNDLE_V3",
        "system_date": config["system_date"],
        "forecast_origin": config["forecast_origin"],
        "strict_source_min_date": config["strict_source_min_date"],
        "label_maturity_cutoff": config["label_maturity_cutoff"],
        "row_count": int(len(forecasts)),
        "horizons": [3, 6, 12],
        "equities_per_horizon": 58,
        "hard_q50_gate": {
            "median_unique_per_origin_min": HARD_Q50_MEDIAN_UNIQUE,
            "origins_unique_ge_10_rate_min": HARD_Q50_ORIGIN_PASS_RATE,
            "rank_signal_cannot_rescue_failed_q50": True,
        },
        "distribution_gate": {
            "mean_pinball_ratio_to_train_only_empirical_max": 1.05,
            "coverage_80_error_max": 0.12,
            "q10_q90_pinball_ratio_to_fixed_es_reference_max": 1.05,
        },
        "holdout_used_for_early_stopping": False,
        "common_holdout_role": "FINAL_VALIDATION_AND_ELIGIBILITY_GATE",
        "quantile_sorting_or_projection_used": False,
        "economic_price_adjustment_applied": False,
        "horizon_decisions": decisions,
    }
    (artifact_root / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    decision_table = pd.DataFrame(
        [
            {
                "horizon": f"{row['horizon_months']}M",
                "champion": row["champion_id"],
                "features": row["table_kind"],
                "predictors": row["predictor_count"],
                "dev_pinball": row["development_metrics"]["mean_pinball"],
                "holdout_pinball": row["holdout_metrics"]["mean_pinball"],
                "holdout_coverage80": row["holdout_metrics"]["coverage_80"],
                "holdout_q50_unique_median": row["holdout_metrics"]["median_q50_unique_per_origin"],
                "late_pinball": None if row["late_metrics"] is None else row["late_metrics"]["mean_pinball"],
                "all_gates": row["gate"]["eligible"],
            }
            for row in decisions
        ]
    )
    report = [
        "# Forecast Improvement Lab V3",
        "",
        "## Sonuç",
        "",
        decision_table.to_markdown(index=False, floatfmt=".6f"),
        "",
        "## Bağlayıcı düzeltmeler",
        "",
        "- Common holdout hiçbir modelde early stopping veya iterasyon seçimi için kullanılmadı.",
        "- Iterasyonlar yalnız development fold'larından donduruldu.",
        "- q50 sert kapısı ranker'dan bağımsızdır; q50 başarısızsa horizon paketlenmez.",
        "- q10/q90 proper-score bozulması ayrıca sınırlandı.",
        "- Quantile sorting, clipping veya projection uygulanmadı.",
        "",
        "## Denenen aileler",
        "",
        "Fixed-ES quantile, ayrı Huber q50, short-history, rolling bagging, Universe58+residual iki aşama ve development-weighted LightGBM/CatBoost ensemble.",
    ]
    report = [
        "# Forecast Improvement Lab V3",
        "",
        "## Sonuç",
        "",
        decision_table.to_markdown(index=False, floatfmt=".6f"),
        "",
        "## Bağlayıcı düzeltmeler",
        "",
        "- Common holdout hiçbir modelde early stopping veya iterasyon seçimi için kullanılmadı.",
        "- İterasyonlar yalnız development fold'larından donduruldu.",
        "- q50 sert kapısı ranker'dan bağımsızdır; q50 başarısızsa horizon paketlenmez.",
        "- q10/q90 proper-score bozulması ayrıca sınırlandı.",
        "- Quantile sorting, clipping veya projection uygulanmadı.",
        "",
        "## Denenen aileler",
        "",
        "Fixed-ES quantile, ayrı Huber q50, short-history, rolling bagging, Universe58+residual iki aşama ve development-weighted LightGBM/CatBoost ensemble.",
    ]
    (report_root / "forecast_lab_report.md").write_text("\n".join(report), encoding="utf-8")
    print(decision_table.to_string(index=False), flush=True)


if __name__ == "__main__":
    main()
