from __future__ import annotations

import argparse
import json
from dataclasses import replace
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from stable_baselines3 import PPO

from .env_v22 import BistStressEnvV22
from .evaluate_v22 import reward_summary, run_episode, trade_blotter
from .runtime_v22 import RuntimeV22, build_runtime_v22
from .scenarios_v22 import ScenarioPathV22


def _aligned_tpp(config: dict, known_dates: pd.DatetimeIndex, execution_dates: pd.DatetimeIndex) -> tuple[np.ndarray, np.ndarray]:
    tpp = pd.read_parquet(config["paths"]["tpp_overnight"]).copy()
    tpp["data_date"] = pd.to_datetime(tpp["data_date"], errors="raise")
    tpp["weighted_average"] = pd.to_numeric(tpp["weighted_average"], errors="coerce")
    tpp = tpp[
        tpp["eligible_curve_feature"].fillna(False)
        & (tpp["weighted_average"] > 0)
    ].dropna(subset=["data_date", "weighted_average"])
    tpp = tpp.sort_values("data_date")[["data_date", "weighted_average"]]

    def align(dates: pd.DatetimeIndex) -> np.ndarray:
        query = pd.DataFrame({"query_date": dates}).sort_values("query_date")
        merged = pd.merge_asof(
            query,
            tpp,
            left_on="query_date",
            right_on="data_date",
            direction="backward",
            allow_exact_matches=True,
        )
        if merged["weighted_average"].isna().any():
            raise ValueError("Historical TPP could not be aligned causally")
        return merged["weighted_average"].to_numpy(dtype=np.float64)

    return align(known_dates), align(execution_dates)


def build_historical_path(
    runtime: RuntimeV22,
    family: str,
    *,
    active_start: str | None = None,
    active_end: str | None = None,
) -> ScenarioPathV22:
    if family not in {"S1", "S2"}:
        raise ValueError(f"Unknown historical family {family}")
    config = runtime.config
    market = runtime.market
    event = config["data"]["events"][family]
    start_text = str(active_start or event["active_start"])
    end_text = str(active_end or event["active_end"])
    start_date = np.datetime64(start_text)
    end_date = np.datetime64(end_text)
    if start_date > end_date:
        raise ValueError(f"Historical interval start {start_text} is after end {end_text}")
    selected = np.flatnonzero(
        (market.return_dates >= start_date) & (market.return_dates <= end_date)
    )
    if len(selected) == 0 or np.any(np.diff(selected) != 1):
        raise ValueError(
            f"Historical {family} interval {start_text}..{end_text} is absent or non-contiguous"
        )
    first = int(selected[0])
    last = int(selected[-1])
    lookback = int(config["data"]["lookback_sessions"])
    if first < lookback:
        raise ValueError("Insufficient historical warm-up")
    execution_dates = pd.DatetimeIndex(market.return_dates[first : last + 1])
    information_dates = pd.DatetimeIndex(market.dates[first : last + 1])
    known_tpp, realized_tpp = _aligned_tpp(config, information_dates, execution_dates)
    profile = market.event_profiles[family]
    if family == "S1":
        descriptor = (0.175, 0.055, 32.0, 6.0, 1.0, 0.37, 0.85)
    else:
        descriptor = (0.125, 0.045, 39.0, 7.0, 2.0, 0.99, 0.35)
    path = runtime.scenarios._assemble(
        family=family,
        track="historical_event_replay",
        scenario_seed=int(pd.Timestamp(start_text).strftime("%Y%m%d")),
        warm_returns=market.returns[first - lookback : first].copy(),
        warm_usd=market.usd_returns[first - lookback : first].copy(),
        warm_eur=market.eur_returns[first - lookback : first].copy(),
        stock_returns=market.returns[first : last + 1].copy(),
        usd_returns=market.usd_returns[first : last + 1].copy(),
        eur_returns=market.eur_returns[first : last + 1].copy(),
        market_returns=market.market_returns[first : last + 1].copy(),
        start_prices=market.closes[first].copy(),
        tpp_rates=realized_tpp,
        gaps=market.session_accrual_days[first : last + 1].copy(),
        segments=[f"HISTORICAL_{family}"] * len(selected),
        descriptor=descriptor,
        asset_loading=profile.asset_loading,
        asset_uncertainty=profile.asset_uncertainty,
    )
    direct_prices = market.closes[first - lookback : last + 2].copy()
    direct_usd = market.usd_levels[first - lookback : last + 2].copy()
    direct_eur = market.eur_levels[first - lookback : last + 2].copy()
    direct_market = market.market_returns[first - lookback : last + 1].copy()
    if direct_prices.shape != path.prices.shape:
        raise RuntimeError("Historical path shape mismatch")
    return replace(
        path,
        dates=[date.strftime("%Y-%m-%d") for date in execution_dates],
        prices=direct_prices,
        usd_levels=direct_usd,
        eur_levels=direct_eur,
        market_returns=direct_market,
        tpp_known_rates=known_tpp,
        tpp_realized_rates=realized_tpp,
        information_cutoffs=[date.strftime("%Y-%m-%d") for date in information_dates],
    )


def evaluate_historical(config_path: str, model_path: str, output_name: str | None = None) -> Path:
    runtime = build_runtime_v22(config_path)
    config = runtime.config
    model_file = Path(model_path).resolve()
    manifest_file = model_file.parent / "run_manifest.json"
    if not manifest_file.exists() and (model_file.parent.parent / "run_manifest.json").exists():
        manifest_file = model_file.parent.parent / "run_manifest.json"
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    model_seed = int(manifest["model_seed"])
    model = PPO.load(model_file, device=config["ppo"]["device"])
    paths = [build_historical_path(runtime, family) for family in ["S1", "S2"]]
    env = BistStressEnvV22(config, runtime.scenarios, split="test")
    metrics_rows = []
    daily_frames = []
    for path in paths:
        metrics, daily = run_episode(model, env, path, model_seed)
        metrics_rows.append(metrics)
        daily_frames.append(daily)
    symbols = env.symbols
    env.close()
    metrics = pd.DataFrame(metrics_rows)
    steps = pd.concat(daily_frames, ignore_index=True)
    trades = trade_blotter(steps, symbols)
    rewards = reward_summary(steps)
    name = output_name or f"historical_{datetime.now():%Y%m%d_%H%M%S}"
    output_dir = Path(config["paths"]["report_root"]) / name
    output_dir.mkdir(parents=True, exist_ok=False)
    metrics.to_parquet(output_dir / "episode_summary.parquet", index=False)
    metrics.to_csv(output_dir / "episode_summary.csv", index=False)
    steps.to_parquet(output_dir / "daily_portfolio.parquet", index=False)
    steps.to_csv(output_dir / "daily_portfolio.csv.gz", index=False, compression="gzip")
    trades.to_parquet(output_dir / "trade_blotter.parquet", index=False)
    trades.to_csv(output_dir / "trade_blotter.csv.gz", index=False, compression="gzip")
    rewards.to_csv(output_dir / "reward_summary.csv", index=False)
    steps.to_csv(output_dir / "gunluk_portfoy_ve_para.csv", index=False)
    trades[trades["executed"]].to_csv(output_dir / "gunluk_alim_satim.csv", index=False)
    summary = {
        "model_id": config["model"]["id"],
        "model_seed": model_seed,
        "methodological_status": "calibration_diagnostic_not_unseen_test",
        "paths": {
            row["family"]: {
                "days": int(row["days"]),
                "terminal_nav_try": float(row["terminal_nav_try"]),
                "passive_terminal_nav_try": float(row["passive_terminal_nav_try"]),
                "excess_terminal_return": float(row["excess_terminal_return"]),
                "max_drawdown": float(row["max_drawdown"]),
                "passive_max_drawdown": float(row["passive_max_drawdown"]),
            }
            for row in metrics.to_dict(orient="records")
        },
    }
    (output_dir / "historical_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output-name")
    args = parser.parse_args()
    output = evaluate_historical(args.config, args.model, args.output_name)
    print(f"V22_HISTORICAL_COMPLETE {output}", flush=True)


if __name__ == "__main__":
    main()
