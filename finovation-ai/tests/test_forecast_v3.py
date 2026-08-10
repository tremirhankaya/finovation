from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from fund_ml.services import EngineBundles


ROOT = Path(__file__).resolve().parents[1]


def test_v3_bundle_is_exact_differentiated_and_uncrossed() -> None:
    manifest = json.loads(
        (ROOT / "artifacts" / "forecast_bundle_v3" / "manifest.json").read_text(
            encoding="utf-8"
        )
    )
    forecasts = pd.read_parquet(
        ROOT / "artifacts" / "forecast_bundle_v3" / "equity_forecasts.parquet"
    )
    assert manifest["schema_version"] == "EQUITY_FORECAST_BUNDLE_V3"
    assert manifest["row_count"] == 174
    assert manifest["holdout_used_for_early_stopping"] is False
    assert manifest["quantile_sorting_or_projection_used"] is False
    assert manifest["hard_q50_gate"]["rank_signal_cannot_rescue_failed_q50"] is True
    assert len(forecasts) == 174
    assert forecasts.groupby("horizon_months").size().to_dict() == {3: 58, 6: 58, 12: 58}
    assert all(value >= 10 for value in forecasts.groupby("horizon_months")["q50"].nunique())
    assert not (
        (forecasts["q10"] > forecasts["q50"])
        | (forecasts["q50"] > forecasts["q90"])
    ).any()


def test_all_requested_forecast_experiments_were_evaluated() -> None:
    required = {
        "FULL_FIXED_ES_QUANTILE",
        "FULL_HUBER_Q50",
        "SHORT_HUBER_Q50",
        "ROLLING_BAGGED_HUBER_Q50",
        "UNIVERSE58_RESIDUAL_TWO_STAGE_Q50",
        "LIGHTGBM_CATBOOST_DEV_WEIGHTED_ENSEMBLE",
    }
    for horizon in (3, 6, 12):
        payload = json.loads(
            (
                ROOT
                / "reports"
                / "forecast_lab_v3"
                / f"h{horizon:02d}"
                / "candidate_results.json"
            ).read_text(encoding="utf-8")
        )
        assert required.issubset(payload)


def test_each_champion_passes_all_frozen_gates() -> None:
    manifest = json.loads(
        (ROOT / "artifacts" / "forecast_bundle_v3" / "manifest.json").read_text(
            encoding="utf-8"
        )
    )
    assert {row["horizon_months"] for row in manifest["horizon_decisions"]} == {3, 6, 12}
    assert all(row["gate"]["eligible"] for row in manifest["horizon_decisions"])
    assert all(row["final_crossing_rows"] == 0 for row in manifest["horizon_decisions"])


def test_runtime_loads_v3_forecasts() -> None:
    bundles = EngineBundles.load(ROOT)
    assert bundles.forecast_manifest["schema_version"] == "EQUITY_FORECAST_BUNDLE_V3"
    assert all(
        bundles.horizon_forecasts(horizon)["q50"].nunique() >= 10
        for horizon in (3, 6, 12)
    )
