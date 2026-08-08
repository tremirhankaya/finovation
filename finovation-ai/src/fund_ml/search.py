from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from fund_ml.data import (
    ProjectPaths,
    add_relevance_labels,
    development_folds,
    fixed_test_fold,
    load_config,
    load_predictor_contract,
    predictors_for_feature_set,
)
from fund_ml.metrics import date_rank_metrics, ndcg_at_k, quantile_metrics
from fund_ml.models import (
    fit_catboost_multiquantile,
    fit_lgbm_quantiles,
    fit_lgbm_ranker,
)


IDENTITY = [
    "instrument_id",
    "as_of_date",
    "horizon_months",
    "label_target_date",
    "absolute_source_log_return",
    "absolute_source_price_return",
]


def prediction_frame(valid: pd.DataFrame, values: np.ndarray, fold_id: str) -> pd.DataFrame:
    output = valid[IDENTITY].copy()
    output["fold_id"] = fold_id
    output["prediction_log_q10"] = values[:, 0]
    output["prediction_log_q50"] = values[:, 1]
    output["prediction_log_q90"] = values[:, 2]
    return output


def empirical_predictions(
    train: pd.DataFrame, valid: pd.DataFrame, by_instrument: bool = False
) -> pd.DataFrame:
    output = valid[IDENTITY].copy()
    global_values = train["absolute_source_log_return"].quantile([0.1, 0.5, 0.9])
    if by_instrument:
        grouped = train.groupby("instrument_id")["absolute_source_log_return"]
        counts = grouped.size()
        quantiles = grouped.quantile([0.1, 0.5, 0.9]).unstack()
        for quantile in (0.1, 0.5, 0.9):
            mapping = quantiles[quantile].where(counts.ge(30)).to_dict()
            output[f"prediction_log_q{int(quantile * 100):02d}"] = (
                output["instrument_id"].map(mapping).fillna(float(global_values.loc[quantile]))
            )
    else:
        for quantile in (0.1, 0.5, 0.9):
            output[f"prediction_log_q{int(quantile * 100):02d}"] = float(
                global_values.loc[quantile]
            )
    return output


def aggregate_quantile(frame: pd.DataFrame) -> dict:
    metrics = quantile_metrics(frame)
    fold_metrics: list[dict] = []
    for fold_id, part in frame.groupby("fold_id", sort=True):
        fold_metrics.append({"fold_id": str(fold_id), **quantile_metrics(part)})
    finite_ic = [
        float(row["mean_date_spearman"])
        for row in fold_metrics
        if pd.notna(row["mean_date_spearman"])
    ]
    metrics["worst_fold_mean_date_spearman"] = min(finite_ic) if finite_ic else float("nan")
    metrics["positive_spread_fold_count"] = int(
        sum(float(row["mean_top_bottom_20_spread"]) > 0 for row in fold_metrics)
    )
    metrics["fold_count"] = len(fold_metrics)
    metrics["fold_metrics"] = fold_metrics
    return metrics


def quantile_oof(
    table: pd.DataFrame,
    config: dict,
    predictors: list[str],
    family: str,
    candidate_id: str,
    params: dict,
    horizon: int,
) -> tuple[pd.DataFrame, list[dict]]:
    frames: list[pd.DataFrame] = []
    records: list[dict] = []
    for fold_index, fold in enumerate(development_folds(table, config)):
        started = time.time()
        seed = int(config["random_seed"]) + horizon * 100 + fold_index
        if family == "LIGHTGBM":
            values, iterations = fit_lgbm_quantiles(
                fold.train, fold.valid, predictors, params, seed
            )
            detail: dict = {"best_iterations": iterations}
        elif family == "CATBOOST":
            values, iteration = fit_catboost_multiquantile(
                fold.train, fold.valid, predictors, params, seed
            )
            detail = {"best_iterations": {"multi": iteration}}
        else:
            raise ValueError(family)
        frames.append(prediction_frame(fold.valid, values, fold.fold_id))
        record = {
            "fold_id": fold.fold_id,
            "train_rows": int(len(fold.train)),
            "validation_rows": int(len(fold.valid)),
            "elapsed_seconds": round(time.time() - started, 3),
            **detail,
        }
        records.append(record)
        print(
            f"h={horizon} {candidate_id} {fold.fold_id} "
            f"train={len(fold.train)} valid={len(fold.valid)} sec={record['elapsed_seconds']}",
            flush=True,
        )
    return pd.concat(frames, ignore_index=True), records


def baseline_oof(table: pd.DataFrame, config: dict, by_instrument: bool) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for fold in development_folds(table, config):
        prediction = empirical_predictions(fold.train, fold.valid, by_instrument)
        prediction["fold_id"] = fold.fold_id
        frames.append(prediction)
    return pd.concat(frames, ignore_index=True)


def choose_feature_set(rows: list[dict]) -> str:
    ordered = sorted(rows, key=lambda row: float(row["mean_pinball"]))
    best = ordered[0]
    equity = next(row for row in rows if row["feature_set"] == "EQUITY_ONLY")
    improvement = (
        float(equity["mean_pinball"]) - float(best["mean_pinball"])
    ) / float(equity["mean_pinball"])
    return str(best["feature_set"] if improvement >= 0.005 else "EQUITY_ONLY")


def quantile_gate(metrics: dict, baseline: dict, gates: dict) -> dict:
    ratio = float(metrics["mean_pinball"]) / float(baseline["mean_pinball"])
    structure_pass = bool(
        float(metrics["coverage_80_error"]) <= float(gates["max_coverage_80_error"])
        and float(metrics["core_crossing_rate"]) <= float(gates["max_core_crossing_rate"])
        and float(metrics["median_q50_unique_per_origin"])
        >= float(gates["minimum_q50_unique"])
    )
    if structure_pass and ratio <= 0.99:
        status = "GO"
    elif structure_pass and ratio <= 1.02:
        status = "CONDITIONAL_GO"
    else:
        status = "NO_GO"
    selection_pass = bool(
        float(metrics["mean_date_spearman"]) >= float(gates["minimum_mean_date_spearman"])
        and float(metrics["positive_date_spearman_rate"])
        >= float(gates["minimum_positive_date_spearman_rate"])
        and float(metrics["mean_top_bottom_20_spread"])
        > float(gates["minimum_top_bottom_20_spread"])
        and float(metrics["worst_fold_mean_date_spearman"])
        > float(gates["maximum_worst_fold_spearman_loss"])
    )
    return {
        "distribution_status": status,
        "pinball_ratio_to_empirical": ratio,
        "structure_pass": structure_pass,
        "q50_selection_pass": selection_pass,
    }


def run_quantile(root: Path, horizon: int) -> dict:
    paths = ProjectPaths(root)
    config = load_config(paths)
    contract = load_predictor_contract(paths)
    table = pd.read_parquet(root / "data" / "processed" / f"training_h{horizon:02d}.parquet")
    for column in ("as_of_date", "label_target_date"):
        table[column] = pd.to_datetime(table[column])
    report_dir = root / "reports" / "model_search" / f"h{horizon:02d}"
    prediction_dir = root / "outputs" / "oof" / f"h{horizon:02d}"
    report_dir.mkdir(parents=True, exist_ok=True)
    prediction_dir.mkdir(parents=True, exist_ok=True)

    baseline_rows: list[dict] = []
    baseline_frames: dict[str, pd.DataFrame] = {}
    for baseline_id, by_instrument in (("EMPIRICAL_GLOBAL", False), ("EMPIRICAL_BY_STOCK", True)):
        frame = baseline_oof(table, config, by_instrument)
        metrics = aggregate_quantile(frame)
        baseline_rows.append({"candidate_id": baseline_id, **metrics})
        baseline_frames[baseline_id] = frame
    baseline_rows.sort(key=lambda row: float(row["mean_pinball"]))
    best_baseline = baseline_rows[0]
    pd.DataFrame([{k: v for k, v in row.items() if k != "fold_metrics"} for row in baseline_rows]).to_csv(
        report_dir / "baseline_metrics.csv", index=False
    )

    ablation_rows: list[dict] = []
    ablation_cache: dict[str, tuple[pd.DataFrame, list[dict]]] = {}
    anchor = config["quantile_candidates"]["Q_BALANCED"]
    for feature_set in config["feature_sets"]:
        predictors = predictors_for_feature_set(contract, feature_set)
        frame, records = quantile_oof(
            table, config, predictors, "LIGHTGBM", f"ABLATION_{feature_set}", anchor, horizon
        )
        metrics = aggregate_quantile(frame)
        ablation_rows.append(
            {"feature_set": feature_set, "predictor_count": len(predictors), **metrics}
        )
        ablation_cache[feature_set] = (frame, records)
    selected_feature_set = choose_feature_set(ablation_rows)
    pd.DataFrame(
        [{k: v for k, v in row.items() if k != "fold_metrics"} for row in ablation_rows]
    ).to_csv(report_dir / "feature_ablation_metrics.csv", index=False)
    predictors = predictors_for_feature_set(contract, selected_feature_set)

    candidate_results: list[dict] = []
    candidate_frames: dict[str, pd.DataFrame] = {}
    candidate_records: dict[str, list[dict]] = {}
    for name, params in config["quantile_candidates"].items():
        candidate_id = f"LIGHTGBM_{name}"
        if name == "Q_BALANCED":
            frame, records = ablation_cache[selected_feature_set]
        else:
            frame, records = quantile_oof(
                table, config, predictors, "LIGHTGBM", candidate_id, params, horizon
            )
        metrics = aggregate_quantile(frame)
        candidate_results.append(
            {"candidate_id": candidate_id, "family": "LIGHTGBM", **metrics}
        )
        candidate_frames[candidate_id] = frame
        candidate_records[candidate_id] = records
    for name, params in config["catboost_candidates"].items():
        candidate_id = f"CATBOOST_{name}"
        frame, records = quantile_oof(
            table, config, predictors, "CATBOOST", candidate_id, params, horizon
        )
        metrics = aggregate_quantile(frame)
        candidate_results.append(
            {"candidate_id": candidate_id, "family": "CATBOOST", **metrics}
        )
        candidate_frames[candidate_id] = frame
        candidate_records[candidate_id] = records

    gates = config["quality_gates"]
    compliant = [
        row
        for row in candidate_results
        if float(row["core_crossing_rate"]) <= float(gates["max_core_crossing_rate"])
        and float(row["coverage_80_error"]) <= float(gates["max_coverage_80_error"])
        and float(row["median_q50_unique_per_origin"]) >= float(gates["minimum_q50_unique"])
    ]
    pool = compliant or candidate_results
    selected = min(
        pool,
        key=lambda row: (
            float(row["mean_pinball"]) * (1.0 + float(row["coverage_80_error"])),
            -float(row["mean_date_spearman"]),
            str(row["candidate_id"]),
        ),
    )
    selected_id = str(selected["candidate_id"])
    candidate_frames[selected_id].to_parquet(
        prediction_dir / "selected_quantile_development_oof.parquet", index=False
    )
    pd.DataFrame(
        [{k: v for k, v in row.items() if k != "fold_metrics"} for row in candidate_results]
    ).to_csv(report_dir / "quantile_candidate_metrics.csv", index=False)

    holdout = fixed_test_fold(table, config)
    holdout_baseline = empirical_predictions(holdout.train, holdout.valid, False)
    holdout_baseline["fold_id"] = holdout.fold_id
    holdout_baseline_metrics = aggregate_quantile(holdout_baseline)
    family, name = selected_id.split("_", 1)
    if family == "LIGHTGBM":
        params = config["quantile_candidates"][name]
        values, iterations = fit_lgbm_quantiles(
            holdout.train,
            holdout.valid,
            predictors,
            params,
            int(config["random_seed"]) + horizon * 1000,
        )
        best_iterations: dict = iterations
    else:
        params = config["catboost_candidates"][name]
        values, iteration = fit_catboost_multiquantile(
            holdout.train,
            holdout.valid,
            predictors,
            params,
            int(config["random_seed"]) + horizon * 1000,
        )
        best_iterations = {"multi": iteration}
    holdout_prediction = prediction_frame(holdout.valid, values, holdout.fold_id)
    holdout_prediction.to_parquet(
        prediction_dir / "selected_quantile_common_holdout.parquet", index=False
    )
    holdout_metrics = aggregate_quantile(holdout_prediction)
    dev_gate = quantile_gate(selected, best_baseline, gates)
    holdout_gate = quantile_gate(holdout_metrics, holdout_baseline_metrics, gates)

    selection = {
        "horizon_months": horizon,
        "feature_set": selected_feature_set,
        "predictor_count": len(predictors),
        "candidate_id": selected_id,
        "family": family,
        "candidate_name": name,
        "development_metrics": selected,
        "development_best_baseline": best_baseline,
        "development_gate": dev_gate,
        "holdout_metrics": holdout_metrics,
        "holdout_baseline_metrics": holdout_baseline_metrics,
        "holdout_gate": holdout_gate,
        "development_fit_records": candidate_records[selected_id],
        "holdout_best_iterations": best_iterations,
        "sealed_holdout_opened_once": True,
        "quantile_sorting_or_projection_used": False,
    }
    (report_dir / "quantile_selection.json").write_text(
        json.dumps(selection, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return selection


def rank_metrics(frame: pd.DataFrame, score: str) -> dict:
    result = date_rank_metrics(frame, score)
    result["ndcg_at_10"] = ndcg_at_k(frame, score, "relevance", 10)
    result["rows"] = int(len(frame))
    result["origins"] = int(frame["as_of_date"].nunique())
    return result


def ranker_oof(
    table: pd.DataFrame,
    config: dict,
    predictors: list[str],
    candidate_id: str,
    params: dict,
    horizon: int,
) -> tuple[pd.DataFrame, list[dict]]:
    frames: list[pd.DataFrame] = []
    records: list[dict] = []
    for index, fold in enumerate(development_folds(table, config)):
        train = add_relevance_labels(fold.train)
        valid = add_relevance_labels(fold.valid)
        started = time.time()
        prediction, iteration = fit_lgbm_ranker(
            train,
            valid,
            predictors,
            params,
            int(config["random_seed"]) + horizon * 100 + index,
        )
        prediction["fold_id"] = fold.fold_id
        frames.append(prediction)
        records.append(
            {
                "fold_id": fold.fold_id,
                "best_iteration": iteration,
                "elapsed_seconds": round(time.time() - started, 3),
            }
        )
        print(f"h={horizon} {candidate_id} {fold.fold_id} ranker complete", flush=True)
    return pd.concat(frames, ignore_index=True), records


def ranker_gate(metrics: dict, baseline: dict, gates: dict) -> dict:
    ndcg_improvement = float(metrics["ndcg_at_10"]) / float(baseline["ndcg_at_10"]) - 1.0
    passed = bool(
        float(metrics["mean_date_spearman"]) >= float(gates["minimum_mean_date_spearman"])
        and float(metrics["positive_date_spearman_rate"])
        >= float(gates["minimum_positive_date_spearman_rate"])
        and float(metrics["mean_top_bottom_20_spread"])
        > float(gates["minimum_top_bottom_20_spread"])
        and ndcg_improvement >= 0.01
    )
    return {"status": "GO" if passed else "NO_GO", "ndcg_improvement": ndcg_improvement}


def run_ranker(root: Path, horizon: int) -> dict:
    paths = ProjectPaths(root)
    config = load_config(paths)
    contract = load_predictor_contract(paths)
    report_dir = root / "reports" / "model_search" / f"h{horizon:02d}"
    selection = json.loads((report_dir / "quantile_selection.json").read_text(encoding="utf-8"))
    feature_set = str(selection["feature_set"])
    predictors = predictors_for_feature_set(contract, feature_set)
    table = pd.read_parquet(root / "data" / "processed" / f"training_h{horizon:02d}.parquet")
    for column in ("as_of_date", "label_target_date"):
        table[column] = pd.to_datetime(table[column])
    output_dir = root / "outputs" / "oof" / f"h{horizon:02d}"

    baseline_frames: list[pd.DataFrame] = []
    for fold in development_folds(table, config):
        valid = add_relevance_labels(fold.valid)
        base = valid[IDENTITY + ["relevance"]].copy()
        base["rank_score"] = valid["source_log_return_126"].to_numpy(dtype=float)
        base["fold_id"] = fold.fold_id
        baseline_frames.append(base)
    baseline_oof_frame = pd.concat(baseline_frames, ignore_index=True)
    baseline_metrics = rank_metrics(baseline_oof_frame, "rank_score")

    candidates: list[dict] = []
    frames: dict[str, pd.DataFrame] = {}
    records: dict[str, list[dict]] = {}
    for name, params in config["ranker_candidates"].items():
        candidate_id = f"LGBMRANKER_{name}"
        frame, fit_records = ranker_oof(
            table, config, predictors, candidate_id, params, horizon
        )
        metrics = rank_metrics(frame, "rank_score")
        fold_ics = [
            date_rank_metrics(part, "rank_score")["mean_date_spearman"]
            for _, part in frame.groupby("fold_id")
        ]
        metrics["worst_fold_mean_date_spearman"] = float(np.nanmin(fold_ics))
        candidates.append({"candidate_id": candidate_id, **metrics})
        frames[candidate_id] = frame
        records[candidate_id] = fit_records
    selected = max(
        candidates,
        key=lambda row: (
            float(row["mean_date_spearman"]),
            float(row["ndcg_at_10"]),
            float(row["mean_top_bottom_20_spread"]),
        ),
    )
    selected_id = str(selected["candidate_id"])
    selected_name = selected_id.removeprefix("LGBMRANKER_")
    frames[selected_id].to_parquet(output_dir / "selected_ranker_development_oof.parquet", index=False)
    pd.DataFrame(candidates).to_csv(report_dir / "ranker_candidate_metrics.csv", index=False)

    holdout = fixed_test_fold(table, config)
    train = add_relevance_labels(holdout.train)
    valid = add_relevance_labels(holdout.valid)
    prediction, best_iteration = fit_lgbm_ranker(
        train,
        valid,
        predictors,
        config["ranker_candidates"][selected_name],
        int(config["random_seed"]) + horizon * 1000,
    )
    prediction["fold_id"] = holdout.fold_id
    prediction.to_parquet(output_dir / "selected_ranker_common_holdout.parquet", index=False)
    holdout_metrics = rank_metrics(prediction, "rank_score")
    baseline_holdout = valid[IDENTITY + ["relevance"]].copy()
    baseline_holdout["rank_score"] = valid["source_log_return_126"].to_numpy(dtype=float)
    baseline_holdout_metrics = rank_metrics(baseline_holdout, "rank_score")
    gates = config["quality_gates"]
    result = {
        "horizon_months": horizon,
        "feature_set": feature_set,
        "candidate_id": selected_id,
        "candidate_name": selected_name,
        "development_metrics": selected,
        "development_baseline_metrics": baseline_metrics,
        "development_gate": ranker_gate(selected, baseline_metrics, gates),
        "holdout_metrics": holdout_metrics,
        "holdout_baseline_metrics": baseline_holdout_metrics,
        "holdout_gate": ranker_gate(holdout_metrics, baseline_holdout_metrics, gates),
        "development_fit_records": records[selected_id],
        "holdout_best_iteration": best_iteration,
        "sealed_holdout_opened_once": True,
    }
    (report_dir / "ranker_selection.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Cutoff-safe model search")
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--horizon", type=int, choices=[3, 6, 12], required=True)
    parser.add_argument("--phase", choices=["quantile", "ranker", "all"], default="all")
    args = parser.parse_args()
    if args.phase in {"quantile", "all"}:
        run_quantile(args.root.resolve(), args.horizon)
    if args.phase in {"ranker", "all"}:
        run_ranker(args.root.resolve(), args.horizon)


if __name__ == "__main__":
    main()
