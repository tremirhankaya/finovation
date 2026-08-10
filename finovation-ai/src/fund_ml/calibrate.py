from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from fund_ml.data import ProjectPaths, load_config
from fund_ml.metrics import quantile_metrics


PREDICTION_COLUMNS = ["prediction_log_q10", "prediction_log_q50", "prediction_log_q90"]
QUANTILES = [0.10, 0.50, 0.90]


def calibration_offsets(frame: pd.DataFrame) -> dict[str, float]:
    target = frame["absolute_source_log_return"].to_numpy(dtype=float)
    result: dict[str, float] = {}
    for column, quantile in zip(PREDICTION_COLUMNS, QUANTILES, strict=True):
        residual = target - frame[column].to_numpy(dtype=float)
        result[column] = float(np.quantile(residual, quantile))
    return result


def apply_offsets(frame: pd.DataFrame, offsets: dict[str, float]) -> pd.DataFrame:
    output = frame.copy()
    for column in PREDICTION_COLUMNS:
        output[column] = output[column].astype(float) + float(offsets[column])
    return output


def distribution_gate(metrics: dict, baseline: dict, gates: dict) -> dict:
    ratio = float(metrics["mean_pinball"]) / float(baseline["mean_pinball"])
    passed = bool(
        float(metrics["coverage_80_error"]) <= float(gates["max_coverage_80_error"])
        and float(metrics["core_crossing_rate"]) <= float(gates["max_core_crossing_rate"])
        and ratio <= 1.02
    )
    return {
        "status": "GO" if passed else "NO_GO",
        "pinball_ratio_to_empirical": ratio,
        "coverage_pass": float(metrics["coverage_80_error"])
        <= float(gates["max_coverage_80_error"]),
        "crossing_pass": float(metrics["core_crossing_rate"])
        <= float(gates["max_core_crossing_rate"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Causal residual quantile calibration")
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--horizon", type=int, choices=[3, 6, 12], required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    config = load_config(ProjectPaths(root))
    horizon = args.horizon
    search_dir = root / "reports" / "model_search" / f"h{horizon:02d}"
    output_dir = root / "outputs" / "oof" / f"h{horizon:02d}"
    selection_path = search_dir / "quantile_selection.json"
    selection = json.loads(selection_path.read_text(encoding="utf-8"))
    development = pd.read_parquet(output_dir / "selected_quantile_development_oof.parquet")
    holdout = pd.read_parquet(output_dir / "selected_quantile_common_holdout.parquet")
    for frame in (development, holdout):
        frame["label_target_date"] = pd.to_datetime(frame["label_target_date"])

    holdout_start = pd.Timestamp(config["sealed_holdout"]["start"])
    causal_calibration = development.loc[
        development["label_target_date"].lt(holdout_start)
    ].copy()
    if len(causal_calibration) < 1000:
        raise RuntimeError("Insufficient matured OOF residuals for causal calibration")
    holdout_offsets = calibration_offsets(causal_calibration)
    calibrated_holdout = apply_offsets(holdout, holdout_offsets)
    calibrated_metrics = quantile_metrics(calibrated_holdout)
    calibrated_holdout.to_parquet(
        output_dir / "selected_quantile_common_holdout_calibrated.parquet", index=False
    )

    final_source = pd.concat([development, holdout], ignore_index=True)
    final_source = final_source.loc[
        final_source["label_target_date"].le(pd.Timestamp(config["label_maturity_cutoff"]))
    ]
    final_offsets = calibration_offsets(final_source)
    crossing = (
        calibrated_holdout["prediction_log_q10"]
        > calibrated_holdout["prediction_log_q50"]
    ) | (
        calibrated_holdout["prediction_log_q50"]
        > calibrated_holdout["prediction_log_q90"]
    )
    raw_holdout_metrics = quantile_metrics(holdout)
    raw_gate = distribution_gate(
        raw_holdout_metrics,
        selection["holdout_baseline_metrics"],
        config["quality_gates"],
    )
    calibrated_gate = distribution_gate(
        calibrated_metrics,
        selection["holdout_baseline_metrics"],
        config["quality_gates"],
    )
    accepted = bool(
        raw_gate["status"] != "GO"
        and calibrated_gate["status"] == "GO"
        and float(calibrated_metrics["mean_pinball"])
        <= 1.02 * float(raw_holdout_metrics["mean_pinball"])
    )
    deployment_offsets = final_offsets if accepted else {
        column: 0.0 for column in PREDICTION_COLUMNS
    }
    result = {
        "method": "CAUSAL_RESIDUAL_QUANTILE_OFFSET_V1",
        "accepted": accepted,
        "decision_reason": (
            "ACCEPTED_COVERAGE_REPAIR"
            if accepted
            else "REJECTED_RAW_HOLDOUT_ALREADY_PASS_OR_PROPER_SCORE_DEGRADED"
        ),
        "holdout_calibration_source_rows": int(len(causal_calibration)),
        "holdout_calibration_source_target_max": str(
            causal_calibration["label_target_date"].max().date()
        ),
        "holdout_offsets": holdout_offsets,
        "holdout_calibrated_metrics": calibrated_metrics,
        "raw_holdout_metrics": raw_holdout_metrics,
        "raw_holdout_gate": raw_gate,
        "holdout_calibrated_gate": calibrated_gate,
        "final_deployment_offsets": deployment_offsets,
        "final_calibration_rows": int(len(final_source)),
        "calibrated_holdout_crossing_rows": int(crossing.sum()),
        "quantile_sorting_or_projection_used": False,
    }
    selection["calibration"] = result
    selection_path.write_text(
        json.dumps(selection, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (search_dir / "quantile_calibration.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
