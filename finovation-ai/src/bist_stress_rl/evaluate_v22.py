from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from stable_baselines3 import PPO

from .env_v22 import BistStressEnvV22
from .runtime_v22 import build_runtime_v22
from .scenarios_v22 import ScenarioPathV22


def _maximum_drawdown(values: np.ndarray) -> float:
    values = np.asarray(values, dtype=np.float64)
    return float(np.max(1.0 - values / np.maximum.accumulate(values)))


def run_episode(
    model: PPO,
    env: BistStressEnvV22,
    path: ScenarioPathV22,
    model_seed: int,
) -> tuple[dict[str, Any], pd.DataFrame]:
    observation, _ = env.reset(options={"scenario_path": path})
    done = False
    while not done:
        action, _ = model.predict(observation, deterministic=True)
        observation, _, terminated, truncated, _ = env.step(action)
        done = bool(terminated or truncated)
    daily = pd.DataFrame(env.history)
    path_id = f"{path.family}_{int(path.scenario_seed):08d}"
    daily.insert(0, "path_id", path_id)
    daily.insert(0, "model_seed", int(model_seed))
    initial_nav = float(env.config["project"]["initial_nav_try"])
    agent_curve = np.r_[initial_nav, daily["nav"].to_numpy(dtype=float)]
    passive_curve = np.r_[initial_nav, daily["passive_nav"].to_numpy(dtype=float)]
    reward_columns = [
        "reward_relative",
        "reward_mdd_absolute",
        "reward_mdd_relative",
        "reward_target_change",
    ]
    metrics = {
        "model_id": env.config["model"]["id"],
        "model_seed": int(model_seed),
        "path_id": path_id,
        "family": path.family,
        "scenario_track": path.track,
        "scenario_seed": int(path.scenario_seed),
        "days": int(len(daily)),
        "initial_nav_try": initial_nav,
        "terminal_nav_try": float(agent_curve[-1]),
        "passive_terminal_nav_try": float(passive_curve[-1]),
        "terminal_profit_loss_try": float(agent_curve[-1] - initial_nav),
        "passive_profit_loss_try": float(passive_curve[-1] - initial_nav),
        "terminal_return": float(agent_curve[-1] / initial_nav - 1.0),
        "passive_terminal_return": float(passive_curve[-1] / initial_nav - 1.0),
        "excess_terminal_return": float((agent_curve[-1] - passive_curve[-1]) / initial_nav),
        "max_drawdown": _maximum_drawdown(agent_curve),
        "passive_max_drawdown": _maximum_drawdown(passive_curve),
        "total_reward": float(daily["reward"].sum()),
        "target_change_turnover": float(daily["target_change_turnover"].sum()),
        "maintenance_turnover": float(daily["maintenance_turnover"].sum()),
        "realized_turnover": float(daily["realized_turnover"].sum()),
        "total_commission_try": float(daily["commission"].sum()),
        "trade_days": int((daily["realized_turnover"] > 1e-12).sum()),
        "target_update_days": int((daily["target_change_turnover"] > 1e-12).sum()),
        "illegal_days": int((~daily["post_trade_legal"].astype(bool)).sum()),
        "passive_prospectus_violation_days": int((~daily["passive_legal"].astype(bool)).sum()),
    }
    for column in reward_columns:
        metrics[f"sum_{column}"] = float(daily[column].sum())
        metrics[f"positive_days_{column}"] = int((daily[column] > 1e-12).sum())
        metrics[f"negative_days_{column}"] = int((daily[column] < -1e-12).sum())
    metrics["mdd_improvement"] = metrics["passive_max_drawdown"] - metrics["max_drawdown"]
    return metrics, daily


def trade_blotter(steps: pd.DataFrame, symbols: list[str]) -> pd.DataFrame:
    identifying = [
        "model_id",
        "model_seed",
        "path_id",
        "family",
        "scenario_track",
        "scenario_seed",
        "scenario_day",
        "date",
        "information_cutoff",
        "execution_date",
        "decoded_status",
        "nav",
        "passive_nav",
        "reward",
    ]
    frames: list[pd.DataFrame] = []
    for symbol in symbols:
        columns = identifying + [
            f"price_t_minus_1_{symbol}",
            f"price_t_{symbol}",
            f"units_before_{symbol}",
            f"units_after_{symbol}",
            f"value_before_{symbol}",
            f"value_after_{symbol}",
            f"pre_weight_{symbol}",
            f"previous_target_{symbol}",
            f"target_weight_{symbol}",
            f"weight_{symbol}",
            f"trade_try_{symbol}",
            f"buy_try_{symbol}",
            f"sell_try_{symbol}",
            f"commission_try_{symbol}",
        ]
        frame = steps[columns].copy()
        frame["instrument"] = symbol
        frame["asset_type"] = "TPP" if symbol == symbols[-1] else "EQUITY"
        rename = {
            f"price_t_minus_1_{symbol}": "price_t_minus_1",
            f"price_t_{symbol}": "price_t",
            f"units_before_{symbol}": "units_before",
            f"units_after_{symbol}": "units_after",
            f"value_before_{symbol}": "value_before_try",
            f"value_after_{symbol}": "value_after_try",
            f"pre_weight_{symbol}": "pretrade_weight",
            f"previous_target_{symbol}": "previous_target_weight",
            f"target_weight_{symbol}": "committed_target_weight",
            f"weight_{symbol}": "posttrade_weight",
            f"trade_try_{symbol}": "net_trade_try",
            f"buy_try_{symbol}": "buy_try",
            f"sell_try_{symbol}": "sell_try",
            f"commission_try_{symbol}": "commission_try",
        }
        frame = frame.rename(columns=rename)
        frame["side"] = np.select(
            [frame["net_trade_try"] > 1e-9, frame["net_trade_try"] < -1e-9],
            ["BUY", "SELL"],
            default="HOLD",
        )
        frame["executed"] = frame["net_trade_try"].abs() > 1e-9
        frames.append(frame)
    return pd.concat(frames, ignore_index=True)


def reward_summary(steps: pd.DataFrame) -> pd.DataFrame:
    components = [
        "reward_relative",
        "reward_mdd_absolute",
        "reward_mdd_relative",
        "reward_target_change",
    ]
    rows = []
    for (model_id, family), group in steps.groupby(["model_id", "family"]):
        for component in components:
            values = group[component].to_numpy(dtype=float)
            rows.append(
                {
                    "model_id": model_id,
                    "family": family,
                    "component": component,
                    "sum": float(values.sum()),
                    "mean": float(values.mean()),
                    "positive_days": int(np.count_nonzero(values > 1e-12)),
                    "negative_days": int(np.count_nonzero(values < -1e-12)),
                    "zero_days": int(np.count_nonzero(np.abs(values) <= 1e-12)),
                }
            )
    return pd.DataFrame(rows)


def evaluate_v22(
    config_path: str,
    model_path: str,
    *,
    output_name: str | None = None,
    max_paths: int | None = None,
    split: str = "test",
) -> Path:
    if split not in {"validation", "test"}:
        raise ValueError("split must be validation or test")
    runtime = build_runtime_v22(config_path)
    config = runtime.config
    model_path_obj = Path(model_path).resolve()
    run_dir = model_path_obj.parent
    manifest_path = run_dir / "run_manifest.json"
    if not manifest_path.exists() and (run_dir.parent / "run_manifest.json").exists():
        manifest_path = run_dir.parent / "run_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    model_seed = int(manifest.get("model_seed", config["project"]["random_seed"]))
    model = PPO.load(model_path_obj, device=config["ppo"]["device"])
    paths = runtime.scenarios.frozen_paths(split)
    if max_paths is not None:
        per_family = max(1, int(max_paths) // 2)
        paths = [path for family in ["S1", "S2"] for path in [p for p in paths if p.family == family][:per_family]]
    name = output_name or f"evaluation_{datetime.now():%Y%m%d_%H%M%S}"
    output_dir = Path(config["paths"]["report_root"]) / name
    output_dir.mkdir(parents=True, exist_ok=False)
    env = BistStressEnvV22(config, runtime.scenarios, split=split)
    metric_rows: list[dict[str, Any]] = []
    daily_frames: list[pd.DataFrame] = []
    for index, path in enumerate(paths, start=1):
        metrics, daily = run_episode(model, env, path, model_seed)
        metric_rows.append(metrics)
        daily_frames.append(daily)
        if index % 16 == 0 or index == len(paths):
            print(f"V22_EVALUATION_PROGRESS {index}/{len(paths)}", flush=True)
    env.close()
    metrics = pd.DataFrame(metric_rows)
    steps = pd.concat(daily_frames, ignore_index=True)
    trades = trade_blotter(steps, env.symbols)
    rewards = reward_summary(steps)
    metrics.to_parquet(output_dir / "episode_summary.parquet", index=False)
    metrics.to_csv(output_dir / "episode_summary.csv", index=False)
    steps.to_parquet(output_dir / "daily_portfolio.parquet", index=False)
    steps.to_csv(output_dir / "daily_portfolio.csv.gz", index=False, compression="gzip")
    trades.to_parquet(output_dir / "trade_blotter.parquet", index=False)
    trades.to_csv(output_dir / "trade_blotter.csv.gz", index=False, compression="gzip")
    rewards.to_csv(output_dir / "reward_summary.csv", index=False)
    examples = []
    for family in ["S1", "S2"]:
        selected = metrics[metrics["family"] == family].iloc[0]["path_id"]
        examples.append(steps[steps["path_id"] == selected])
    pd.concat(examples, ignore_index=True).to_csv(
        output_dir / "ornek_gunluk_portfoy_logu.csv", index=False
    )
    trade_examples = trades[trades["path_id"].isin(pd.concat(examples)["path_id"].unique())]
    trade_examples.to_csv(output_dir / "ornek_hisse_islem_logu.csv", index=False)
    summary = {
        "model_id": config["model"]["id"],
        "model_seed": model_seed,
        "split": split,
        "paths": int(len(metrics)),
        "mean_terminal_return": float(metrics["terminal_return"].mean()),
        "mean_passive_terminal_return": float(metrics["passive_terminal_return"].mean()),
        "mean_excess_terminal_return": float(metrics["excess_terminal_return"].mean()),
        "mean_mdd_improvement": float(metrics["mdd_improvement"].mean()),
        "median_realized_turnover": float(metrics["realized_turnover"].median()),
        "median_total_commission_try": float(metrics["total_commission_try"].median()),
        "illegal_days": int(metrics["illegal_days"].sum()),
        "passive_fund_definition": config["universe"]["initial_weights"],
        "passive_behavior": "fixed_units_no_rebalance_no_post_initial_commission",
    }
    (output_dir / "evaluation_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (output_dir / "evaluation_manifest.json").write_text(
        json.dumps(
            {
                "evaluated_at": datetime.now().isoformat(timespec="seconds"),
                "split": split,
                "config": str(Path(config_path).resolve()),
                "model_path": str(model_path_obj),
                "output_files": [
                    "episode_summary.csv",
                    "daily_portfolio.parquet",
                    "trade_blotter.parquet",
                    "reward_summary.csv",
                    "ornek_gunluk_portfoy_logu.csv",
                    "ornek_hisse_islem_logu.csv",
                ],
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"V22_EVALUATION_COMPLETE {output_dir}", flush=True)
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output-name")
    parser.add_argument("--max-paths", type=int)
    parser.add_argument("--split", choices=["validation", "test"], default="test")
    args = parser.parse_args()
    evaluate_v22(
        args.config,
        args.model,
        output_name=args.output_name,
        max_paths=args.max_paths,
        split=args.split,
    )


if __name__ == "__main__":
    main()
