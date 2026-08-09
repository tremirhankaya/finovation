from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.covariance import LedoitWolf

from fund_ml.data import ProjectPaths, load_config


def build_risk(root: Path, config: dict) -> dict:
    source = pd.read_parquet(
        root / "data" / "source" / "equity_prices.parquet",
        columns=[
            "instrument_id",
            "date",
            "source_close",
            "available_from",
            "source_quality_eligible",
        ],
    )
    source["date"] = pd.to_datetime(source["date"])
    source["available_from"] = pd.to_datetime(source["available_from"])
    cutoff = pd.Timestamp(config["forecast_origin"])
    system_date = pd.Timestamp(config["system_date"])
    source = source.loc[
        source["date"].le(cutoff)
        & source["available_from"].le(system_date)
        & source["source_quality_eligible"].astype(bool)
    ].copy()
    source["source_close"] = source["source_close"].astype(float)
    prices = source.pivot(index="date", columns="instrument_id", values="source_close")
    prices = prices.sort_index().tail(505).dropna(axis=0, how="any")
    if prices.shape[1] != 58 or len(prices) < 252:
        raise RuntimeError(f"Risk input expected >=252 complete sessions x 58, got {prices.shape}")
    returns = np.log(prices / prices.shift(1)).dropna()
    estimator = LedoitWolf(assume_centered=False).fit(returns.to_numpy(dtype=float))
    covariance_daily = estimator.covariance_
    covariance_annualized = covariance_daily * 252.0
    weights = np.full(58, 1.0 / 58.0)
    denominator = float(weights @ covariance_daily @ weights)
    if denominator <= 0:
        raise RuntimeError("Universe58 variance is not positive")
    beta = covariance_daily @ weights / denominator
    instruments = prices.columns.to_list()
    beta_frame = pd.DataFrame(
        {
            "instrument_id": instruments,
            "universe58_beta": beta,
            "reference_id": "UNIVERSE58_EQUAL_WEIGHT",
            "lookback_sessions": int(len(returns)),
            "information_cutoff": str(cutoff.date()),
        }
    )
    beta_frame.to_parquet(root / "artifacts" / "risk" / "universe58_beta.parquet", index=False)
    long_covariance = pd.DataFrame(
        {
            "instrument_id_i": np.repeat(instruments, 58),
            "instrument_id_j": np.tile(instruments, 58),
            "covariance_daily": covariance_daily.reshape(-1),
            "covariance_annualized": covariance_annualized.reshape(-1),
        }
    )
    long_covariance.to_parquet(root / "artifacts" / "risk" / "covariance.parquet", index=False)
    manifest = {
        "schema_version": "RISK_BUNDLE_V2",
        "asset_count": 58,
        "asset_order": instruments,
        "information_cutoff": str(cutoff.date()),
        "available_by": str(system_date.date()),
        "lookback_complete_price_sessions": int(len(prices)),
        "lookback_return_sessions": int(len(returns)),
        "covariance_method": "LEDOIT_WOLF_SHRINKAGE",
        "reference_id": "UNIVERSE58_EQUAL_WEIGHT",
        "cash_tpp_beta": 0.0,
        "post_cutoff_data_used": False,
    }
    (root / "artifacts" / "risk" / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return manifest


def build_tpp(root: Path, config: dict) -> dict:
    source = pd.read_csv(root / "data" / "source" / "tpp_day1.csv")
    for column in ("issue_date", "data_date", "maturity_date"):
        source[column] = pd.to_datetime(source[column], errors="raise")
    if not source["day"].eq(1).all():
        raise RuntimeError("TPP tenor other than one day")
    system_date = pd.Timestamp(config["system_date"])
    observed = source.loc[
        source["issue_date"].le(system_date)
        & source["trading_volume_TR"].gt(0)
        & source["transaction_count"].gt(0)
        & source["weighted_average"].gt(0)
    ].copy()
    observed.sort_values(["data_date", "issue_date"], inplace=True)
    conflicting = observed.groupby("data_date")["weighted_average"].nunique().gt(1)
    if conflicting.any():
        dates = [str(value.date()) for value in conflicting[conflicting].index]
        raise RuntimeError(f"Conflicting TPP observations: {dates}")
    observed = observed.drop_duplicates("data_date", keep="first").sort_values("issue_date")
    if observed.empty:
        raise RuntimeError("No observed one-day TPP rate by system date")
    latest = observed.iloc[-1]
    current_rate = float(latest["weighted_average"])
    trailing = observed.tail(252)["weighted_average"].astype(float)
    downside_rate = float(trailing.quantile(0.25))
    origin = pd.Timestamp(config["forecast_origin"])
    rows: list[dict] = []
    for horizon in config["horizons_months"]:
        end = origin + pd.DateOffset(months=int(horizon))
        days = int((end - origin).days)
        median_return = float((1.0 + current_rate / 100.0 / 365.0) ** days - 1.0)
        downside_return = float((1.0 + downside_rate / 100.0 / 365.0) ** days - 1.0)
        rows.append(
            {
                "horizon_months": int(horizon),
                "scenario_median_return": median_return,
                "scenario_downside_return": downside_return,
                "scenario_dispersion": abs(median_return - downside_return),
                "flat_reference_return": median_return,
                "current_annual_rate_percent": current_rate,
                "downside_annual_rate_percent": downside_rate,
                "calendar_days": days,
                "return_semantics": "COMPOUNDED_DAILY_CARRY_FROM_ANNUAL_PERCENT_RATE",
                "information_cutoff": str(system_date.date()),
                "config_id": "TPP_DAY1_CARRY_V2",
            }
        )
    frame = pd.DataFrame(rows)
    frame.to_parquet(root / "artifacts" / "tpp" / "tpp_scenarios.parquet", index=False)
    manifest = {
        "schema_version": "TPP_CARRY_BUNDLE_V2",
        "source_tenor_day": 1,
        "latest_observation_data_date": str(latest["data_date"].date()),
        "latest_issue_date": str(latest["issue_date"].date()),
        "latest_weighted_average_percent": current_rate,
        "information_cutoff": str(system_date.date()),
        "holiday_weekend_behavior": "CALENDAR_DAY_CARRY; ZERO_VOLUME_ROWS_NOT_NEW_RATE_OBSERVATIONS",
        "row_count": 3,
    }
    (root / "artifacts" / "tpp" / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Build risk and one-day TPP carry bundles")
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    (root / "artifacts" / "risk").mkdir(parents=True, exist_ok=True)
    (root / "artifacts" / "tpp").mkdir(parents=True, exist_ok=True)
    config = load_config(ProjectPaths(root))
    result = {"risk": build_risk(root, config), "tpp": build_tpp(root, config)}
    report = root / "reports" / "risk_tpp"
    report.mkdir(parents=True, exist_ok=True)
    (report / "risk_tpp_report.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
