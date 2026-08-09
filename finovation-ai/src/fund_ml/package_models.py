from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from fund_ml.data import (
    ProjectPaths,
    add_relevance_labels,
    load_config,
    load_predictor_contract,
    predictors_for_feature_set,
)
from fund_ml.models import (
    fit_final_catboost_multiquantile,
    fit_final_lgbm_quantiles,
    fit_final_lgbm_ranker,
)


def _median_iterations(selection: dict, family: str) -> dict[str, int] | int:
    records = list(selection["development_fit_records"])
    if family == "LIGHTGBM":
        result: dict[str, int] = {}
        for key in ("q10", "q50", "q90"):
            values = [int(row["best_iterations"][key]) for row in records]
            values.append(int(selection["holdout_best_iterations"][key]))
            result[key] = max(1, int(np.median(values)))
        return result
    values = [int(row["best_iterations"]["multi"]) for row in records]
    values.append(int(selection["holdout_best_iterations"]["multi"]))
    return max(1, int(np.median(values)))


def _quantile_distribution_pass(selection: dict) -> bool:
    calibration = selection.get("calibration")
    if calibration is not None:
        return bool(
            calibration["raw_holdout_gate"]["status"] == "GO"
            and float(selection["development_metrics"]["mean_pinball"])
            <= 1.02 * float(selection["development_best_baseline"]["mean_pinball"])
            and float(selection["development_metrics"]["core_crossing_rate"]) <= 0.005
        )
    statuses = {
        selection["development_gate"]["distribution_status"],
        selection["holdout_gate"]["distribution_status"],
    }
    return "NO_GO" not in statuses


def _q50_selection_pass(selection: dict) -> bool:
    return bool(
        selection["development_gate"]["q50_selection_pass"]
        and selection["holdout_gate"]["q50_selection_pass"]
    )


def _ranker_pass(selection: dict | None) -> bool:
    if selection is None:
        return False
    return bool(
        selection["development_gate"]["status"] == "GO"
        and selection["holdout_gate"]["status"] == "GO"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Fit cutoff-safe final models and freeze bundle")
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    paths = ProjectPaths(root)
    config = load_config(paths)
    contract = load_predictor_contract(paths)
    inference = pd.read_parquet(root / "data" / "processed" / "inference_features.parquet")
    inference["as_of_date"] = pd.to_datetime(inference["as_of_date"])
    artifact_root = root / "artifacts" / "forecast_bundle_v2"
    artifact_root.mkdir(parents=True, exist_ok=True)
    forecast_frames: list[pd.DataFrame] = []
    decisions: list[dict] = []

    for horizon in config["horizons_months"]:
        horizon = int(horizon)
        search_dir = root / "reports" / "model_search" / f"h{horizon:02d}"
        quantile_selection = json.loads(
            (search_dir / "quantile_selection.json").read_text(encoding="utf-8")
        )
        ranker_path = search_dir / "ranker_selection.json"
        ranker_selection = (
            json.loads(ranker_path.read_text(encoding="utf-8"))
            if ranker_path.exists()
            else None
        )
        feature_set = str(quantile_selection["feature_set"])
        predictors = predictors_for_feature_set(contract, feature_set)
        table = pd.read_parquet(
            root / "data" / "processed" / f"training_h{horizon:02d}.parquet"
        )
        for column in ("as_of_date", "label_target_date"):
            table[column] = pd.to_datetime(table[column])
        family = str(quantile_selection["family"])
        name = str(quantile_selection["candidate_name"])
        iterations = _median_iterations(quantile_selection, family)
        model_dir = artifact_root / "models" / f"h{horizon:02d}"
        if family == "LIGHTGBM":
            values = fit_final_lgbm_quantiles(
                table,
                inference,
                predictors,
                config["quantile_candidates"][name],
                iterations,
                int(config["random_seed"]) + horizon * 10000,
                model_dir / "quantile",
            )
        elif family == "CATBOOST":
            values = fit_final_catboost_multiquantile(
                table,
                inference,
                predictors,
                config["catboost_candidates"][name],
                int(iterations),
                int(config["random_seed"]) + horizon * 10000,
                model_dir / "quantile" / "model.cbm",
            )
        else:
            raise RuntimeError(f"Unknown selected family {family}")

        calibration = quantile_selection.get("calibration")
        calibration_id: str | None = None
        if calibration is not None and calibration.get("accepted", False):
            for index, column in enumerate(
                ("prediction_log_q10", "prediction_log_q50", "prediction_log_q90")
            ):
                values[:, index] += float(
                    calibration["final_deployment_offsets"][column]
                )
            calibration_id = "CAUSAL_RESIDUAL_QUANTILE_OFFSET_V1"

        ranker_used = _ranker_pass(ranker_selection)
        rank_score = np.full(len(inference), np.nan, dtype=float)
        ranker_id: str | None = None
        if ranker_used and ranker_selection is not None:
            if ranker_selection["candidate_id"] == "RISK_ADJUSTED_MOMENTUM_126_60_BASELINE":
                volatility = inference["source_realized_volatility_60"].replace(0.0, np.nan)
                rank_score = (
                    inference["source_log_return_126"] / volatility
                ).to_numpy(dtype=float)
                if not np.isfinite(rank_score).all():
                    raise RuntimeError("Non-finite final baseline rank score")
                ranker_id = f"H{horizon:02d}_RISK_ADJUSTED_MOMENTUM_126_60_BASELINE"
            else:
                ranker_name = str(ranker_selection["candidate_name"])
                rank_iterations = [
                    int(row["best_iteration"])
                    for row in ranker_selection["development_fit_records"]
                ] + [int(ranker_selection["holdout_best_iteration"])]
                rank_score = fit_final_lgbm_ranker(
                    add_relevance_labels(table),
                    inference,
                    predictors,
                    config["ranker_candidates"][ranker_name],
                    max(1, int(np.median(rank_iterations))),
                    int(config["random_seed"]) + horizon * 20000,
                    model_dir / "ranker" / "model.txt",
                )
                ranker_id = f"H{horizon:02d}_{ranker_selection['candidate_id']}"

        crossing = (values[:, 0] > values[:, 1]) | (values[:, 1] > values[:, 2])
        distribution_pass = _quantile_distribution_pass(quantile_selection)
        selection_pass = _q50_selection_pass(quantile_selection) or ranker_used
        eligible = bool(distribution_pass and selection_pass and not crossing.any())
        model_id = f"H{horizon:02d}_{quantile_selection['candidate_id']}_{feature_set}"
        frame = inference[["instrument_id", "as_of_date", "feature_available_from"]].copy()
        frame.rename(columns={"as_of_date": "forecast_origin", "feature_available_from": "available_from"}, inplace=True)
        frame["horizon_months"] = horizon
        frame["q10"] = values[:, 0]
        frame["q50"] = values[:, 1]
        frame["q90"] = values[:, 2]
        frame["simple_q10"] = np.expm1(values[:, 0])
        frame["simple_q50"] = np.expm1(values[:, 1])
        frame["simple_q90"] = np.expm1(values[:, 2])
        frame["interval_width"] = values[:, 2] - values[:, 0]
        frame["model_artifact_id"] = model_id
        frame["calibration_id"] = calibration_id
        frame["model_horizon_eligible"] = eligible
        frame["feature_eligible"] = True
        frame["row_eligible"] = eligible
        frame["eligibility_reasons"] = (
            "PASS" if eligible else "MODEL_HORIZON_NOT_ELIGIBLE"
        )
        frame["raw_core_quantile_crossing"] = crossing
        frame["ranker_used"] = ranker_used
        frame["ranker_artifact_id"] = ranker_id
        frame["rank_score"] = rank_score
        if ranker_used:
            rank_series = pd.Series(rank_score)
            frame["rank_position"] = rank_series.rank(ascending=False, method="first").astype(int)
            frame["rank_percentile"] = rank_series.rank(pct=True, method="average")
        else:
            frame["rank_position"] = pd.Series([pd.NA] * len(frame), dtype="Int64")
            frame["rank_percentile"] = np.nan
        frame["model_support_band"] = quantile_selection["holdout_gate"][
            "distribution_status"
        ]
        frame["target_semantics"] = "SOURCE_PRICE_RETURN"
        frame["target_representation"] = "LOG_RETURN"
        forecast_frames.append(frame)
        decisions.append(
            {
                "horizon_months": horizon,
                "quantile_model_id": model_id,
                "ranker_model_id": ranker_id,
                "feature_set": feature_set,
                "predictor_count": len(predictors),
                "quantile_distribution_pass": distribution_pass,
                "q50_selection_pass": _q50_selection_pass(quantile_selection),
                "ranker_pass": ranker_used,
                "final_crossing_rows": int(crossing.sum()),
                "calibration_id": calibration_id,
                "horizon_eligible": eligible,
                "final_iterations": iterations,
            }
        )

    forecasts = pd.concat(forecast_frames, ignore_index=True)
    if len(forecasts) != 174:
        raise RuntimeError(f"Expected 174 forecast rows, got {len(forecasts)}")
    if forecasts.duplicated(["instrument_id", "horizon_months"]).any():
        raise RuntimeError("Duplicate forecast identity")
    forecasts.to_parquet(artifact_root / "equity_forecasts.parquet", index=False)
    manifest = {
        "schema_version": "EQUITY_FORECAST_BUNDLE_V2",
        "system_date": config["system_date"],
        "forecast_origin": config["forecast_origin"],
        "feature_information_cutoff": config["forecast_origin"],
        "label_maturity_cutoff": config["label_maturity_cutoff"],
        "target_semantics": "SOURCE_PRICE_RETURN",
        "target_representation": "LOG_RETURN",
        "horizons": config["horizons_months"],
        "quantiles": config["quantiles"],
        "equities_per_horizon": 58,
        "row_count": 174,
        "horizon_decisions": decisions,
        "quantile_crossing_policy": "HARD_FAIL_NO_REARRANGEMENT",
        "post_cutoff_data_used": False,
        "determinism": "FIXED_SEED_DETERMINISTIC_TRAINING",
    }
    (artifact_root / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    report_dir = root / "reports" / "final_models"
    report_dir.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(decisions).to_csv(report_dir / "horizon_decisions.csv", index=False)
    (report_dir / "model_package_report.md").write_text(
        "# Final Model Paketi\n\n"
        + pd.DataFrame(decisions).to_markdown(index=False)
        + "\n\nQuantile sorting/projection uygulanmadı. NO-GO horizon optimizer tarafından reddedilir.\n",
        encoding="utf-8",
    )
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
