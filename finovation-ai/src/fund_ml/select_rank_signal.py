from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from fund_ml.data import ProjectPaths, load_config
from fund_ml.metrics import date_rank_metrics, ndcg_at_k


BASELINE_ID = "RISK_ADJUSTED_MOMENTUM_126_60_BASELINE"


def metrics(frame: pd.DataFrame, score: str) -> dict:
    result = date_rank_metrics(frame, score)
    result["ndcg_at_10"] = ndcg_at_k(frame, score, "relevance", 10)
    result["rows"] = int(len(frame))
    result["origins"] = int(frame["as_of_date"].nunique())
    return result


def absolute_gate(value: dict, gates: dict) -> bool:
    return bool(
        float(value["mean_date_spearman"]) >= float(gates["minimum_mean_date_spearman"])
        and float(value["positive_date_spearman_rate"])
        >= float(gates["minimum_positive_date_spearman_rate"])
        and float(value["mean_top_bottom_20_spread"])
        > float(gates["minimum_top_bottom_20_spread"])
    )


def baseline_frame(predictions: pd.DataFrame, table: pd.DataFrame) -> pd.DataFrame:
    columns = [
        "instrument_id",
        "as_of_date",
        "source_log_return_126",
        "source_realized_volatility_60",
    ]
    source = table[columns].copy()
    output = predictions.drop(columns=["rank_score"], errors="ignore").merge(
        source, on=["instrument_id", "as_of_date"], how="left", validate="one_to_one"
    )
    volatility = output["source_realized_volatility_60"].replace(0.0, np.nan)
    output["rank_score"] = output["source_log_return_126"] / volatility
    if output["rank_score"].isna().any():
        raise RuntimeError("Missing risk-adjusted momentum score")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description="Choose learned ranker or strong baseline")
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    config = load_config(ProjectPaths(root))
    gates = config["quality_gates"]
    comparisons: list[dict] = []

    for horizon in config["horizons_months"]:
        horizon = int(horizon)
        report_dir = root / "reports" / "model_search" / f"h{horizon:02d}"
        path = report_dir / "ranker_selection.json"
        learned = json.loads(path.read_text(encoding="utf-8"))
        table = pd.read_parquet(
            root / "data" / "processed" / f"training_h{horizon:02d}.parquet"
        )
        table["as_of_date"] = pd.to_datetime(table["as_of_date"])
        output_dir = root / "outputs" / "oof" / f"h{horizon:02d}"
        dev_prediction = pd.read_parquet(output_dir / "selected_ranker_development_oof.parquet")
        hold_prediction = pd.read_parquet(output_dir / "selected_ranker_common_holdout.parquet")
        for frame in (dev_prediction, hold_prediction):
            frame["as_of_date"] = pd.to_datetime(frame["as_of_date"])
        dev_base_frame = baseline_frame(dev_prediction, table)
        hold_base_frame = baseline_frame(hold_prediction, table)
        dev_base = metrics(dev_base_frame, "rank_score")
        hold_base = metrics(hold_base_frame, "rank_score")
        dev_learned = learned["development_metrics"]
        hold_learned = learned["holdout_metrics"]
        dev_improvement = float(dev_learned["ndcg_at_10"]) / float(dev_base["ndcg_at_10"]) - 1.0
        hold_improvement = float(hold_learned["ndcg_at_10"]) / float(hold_base["ndcg_at_10"]) - 1.0
        learned_pass = bool(
            absolute_gate(dev_learned, gates)
            and absolute_gate(hold_learned, gates)
            and dev_improvement >= 0.01
            and hold_improvement >= 0.01
            and float(dev_learned["mean_date_spearman"])
            >= float(dev_base["mean_date_spearman"])
            and float(hold_learned["mean_date_spearman"])
            >= float(hold_base["mean_date_spearman"])
        )
        baseline_pass = absolute_gate(dev_base, gates) and absolute_gate(hold_base, gates)
        comparisons.append(
            {
                "horizon_months": horizon,
                "learned_candidate_id": learned["candidate_id"],
                "learned_dev_ndcg_improvement": dev_improvement,
                "learned_holdout_ndcg_improvement": hold_improvement,
                "learned_pass": learned_pass,
                "baseline_pass": baseline_pass,
                "selected_signal": learned["candidate_id"] if learned_pass else BASELINE_ID,
            }
        )
        learned["strong_baseline_id"] = BASELINE_ID
        learned["strong_baseline_development_metrics"] = dev_base
        learned["strong_baseline_holdout_metrics"] = hold_base
        learned["learned_vs_strong_baseline"] = {
            "development_ndcg_improvement": dev_improvement,
            "holdout_ndcg_improvement": hold_improvement,
            "learned_pass": learned_pass,
        }
        if not learned_pass:
            if not baseline_pass:
                learned["development_gate"] = {"status": "NO_GO"}
                learned["holdout_gate"] = {"status": "NO_GO"}
                learned["selection_signal_type"] = "NO_ELIGIBLE_RANK_SIGNAL"
            else:
                learned["rejected_learned_ranker"] = {
                    "candidate_id": learned["candidate_id"],
                    "development_metrics": dev_learned,
                    "holdout_metrics": hold_learned,
                }
                learned["candidate_id"] = BASELINE_ID
                learned["candidate_name"] = None
                learned["development_metrics"] = dev_base
                learned["holdout_metrics"] = hold_base
                learned["development_baseline_metrics"] = dev_base
                learned["holdout_baseline_metrics"] = hold_base
                learned["development_gate"] = {"status": "GO", "absolute_gate": True}
                learned["holdout_gate"] = {"status": "GO", "absolute_gate": True}
                learned["development_fit_records"] = []
                learned["holdout_best_iteration"] = None
                learned["selection_signal_type"] = "CAUSAL_ENGINEERED_BASELINE_CHAMPION"
                learned["controlled_repair_round"] = 1
                dev_base_frame.to_parquet(
                    output_dir / "selected_rank_signal_development_oof.parquet", index=False
                )
                hold_base_frame.to_parquet(
                    output_dir / "selected_rank_signal_common_holdout.parquet", index=False
                )
        else:
            learned["selection_signal_type"] = "LEARNED_LGBM_RANKER"
        path.write_text(
            json.dumps(learned, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    frame = pd.DataFrame(comparisons)
    report = root / "reports" / "model_search" / "rank_signal_comparison.csv"
    frame.to_csv(report, index=False)
    print(frame.to_string(index=False))


if __name__ == "__main__":
    main()
