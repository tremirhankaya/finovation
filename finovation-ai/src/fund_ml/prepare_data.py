from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from fund_ml.data import (
    ProjectPaths,
    build_horizon_table,
    development_folds,
    fixed_test_fold,
    inference_rows,
    load_inputs,
    rebuild_tpp_rate_features,
)


def _date_range(frame: pd.DataFrame) -> tuple[str, str]:
    return (
        str(pd.Timestamp(frame["as_of_date"].min()).date()),
        str(pd.Timestamp(frame["as_of_date"].max()).date()),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Build cutoff-safe weekly model tables")
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    paths = ProjectPaths(root)
    processed = root / "data" / "processed"
    reports = root / "reports" / "data"
    processed.mkdir(parents=True, exist_ok=True)
    reports.mkdir(parents=True, exist_ok=True)

    features, labels, config, contract = load_inputs(paths)
    _, duplicate_audit = rebuild_tpp_rate_features(
        pd.read_parquet(paths.features), paths.tpp_day1
    )
    duplicate_audit.to_csv(reports / "tpp_source_duplicate_audit.csv", index=False)

    inference = inference_rows(features, config)
    inference.to_parquet(processed / "inference_features.parquet", index=False)

    fold_rows: list[dict] = []
    horizon_rows: list[dict] = []
    for horizon in config["horizons_months"]:
        table = build_horizon_table(features, labels, config, int(horizon))
        table.to_parquet(processed / f"training_h{int(horizon):02d}.parquet", index=False)
        start, end = _date_range(table)
        horizon_rows.append(
            {
                "horizon_months": int(horizon),
                "rows": int(len(table)),
                "origins": int(table["as_of_date"].nunique()),
                "instruments": int(table["instrument_id"].nunique()),
                "origin_start": start,
                "origin_end": end,
                "label_target_max": str(table["label_target_date"].max().date()),
            }
        )
        for fold in [*development_folds(table, config), fixed_test_fold(table, config)]:
            fold_rows.append(
                {
                    "horizon_months": int(horizon),
                    "fold_id": fold.fold_id,
                    "train_rows": int(len(fold.train)),
                    "train_origins": int(fold.train["as_of_date"].nunique()),
                    "train_origin_max": str(fold.train["as_of_date"].max().date()),
                    "train_target_max": str(fold.train["label_target_date"].max().date()),
                    "validation_rows": int(len(fold.valid)),
                    "validation_origins": int(fold.valid["as_of_date"].nunique()),
                    "validation_origin_min": str(fold.valid["as_of_date"].min().date()),
                    "validation_origin_max": str(fold.valid["as_of_date"].max().date()),
                    "purge_pass": bool(
                        fold.train["as_of_date"].max() < fold.valid["as_of_date"].min()
                        and fold.train["label_target_date"].max()
                        < fold.valid["as_of_date"].min()
                    ),
                }
            )

    horizon_inventory = pd.DataFrame(horizon_rows)
    fold_inventory = pd.DataFrame(fold_rows)
    horizon_inventory.to_csv(reports / "horizon_inventory.csv", index=False)
    fold_inventory.to_csv(reports / "fold_inventory.csv", index=False)
    if not fold_inventory["purge_pass"].all():
        raise RuntimeError("One or more PIT purge checks failed")

    manifest = {
        "schema_version": "CUTOFF_SAFE_DATASET_V2",
        "system_date": config["system_date"],
        "forecast_origin": config["forecast_origin"],
        "label_maturity_cutoff": config["label_maturity_cutoff"],
        "training_start_date": config["training_start_date"],
        "target": "absolute_source_log_return",
        "target_semantics": "SOURCE_PRICE_RETURN",
        "weekly_origins": True,
        "random_split": False,
        "purge_rule": "as_of_date < validation_start AND label_target_date < validation_start",
        "predictor_count_source_contract": len(contract["predictors"]),
        "feature_sets": config["feature_sets"],
        "inference_rows": int(len(inference)),
        "inference_instruments": int(inference["instrument_id"].nunique()),
        "tpp_duplicate_rows_reported": int(len(duplicate_audit)),
        "horizons": horizon_rows,
    }
    (reports / "dataset_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    lines = [
        "# Data ve PIT Gate",
        "",
        "Sonuç: **GO**",
        "",
        f"- Sistem tarihi: `{config['system_date']}`",
        f"- Forecast origin: `{config['forecast_origin']}`",
        f"- Label cutoff: `{config['label_maturity_cutoff']}`",
        f"- Eğitim origin alt sınırı: `{config['training_start_date']}`",
        "- Split: haftalık, expanding-window, label-target purged",
        "- TPP: onaylı day=1 CSV; issue_date availability; tatil carry satırı yeni oran sayılmadı",
        "- Missing policy: native NaN, imputation yok",
        "",
        "## Horizon envanteri",
        "",
        horizon_inventory.to_markdown(index=False),
        "",
        "## Fold envanteri",
        "",
        fold_inventory.to_markdown(index=False),
    ]
    (reports / "data_pit_report.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
