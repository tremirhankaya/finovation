from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from stable_baselines3 import PPO

from .constraints import ProspectusConstraints
from .env import BistStressEnv
from .portfolio import PortfolioBook
from .reporting import build_evaluation_dashboard
from .runtime import Runtime, build_runtime
from .scenarios import ScenarioPath


def _maximum_drawdown(values: np.ndarray) -> float:
    curve = np.asarray(values, dtype=np.float64)
    return float(np.max(1.0 - curve / np.maximum.accumulate(curve)))


def _episode_metrics(daily: pd.DataFrame, initial_nav: float) -> dict[str, Any]:
    final = daily.iloc[-1]
    agent_curve = np.r_[initial_nav, daily["nav"].to_numpy(float)]
    passive_curve = np.r_[initial_nav, daily["passive_nav"].to_numpy(float)]
    agent_return = float(agent_curve[-1] / initial_nav - 1.0)
    passive_return = float(passive_curve[-1] / initial_nav - 1.0)
    mdd = _maximum_drawdown(agent_curve)
    passive_mdd = _maximum_drawdown(passive_curve)
    daily_simple = np.diff(agent_curve) / agent_curve[:-1]
    downside = daily_simple[daily_simple < 0]
    return {
        "family": str(final["family"]),
        "scenario_seed": int(final["scenario_seed"]),
        "days": int(len(daily)),
        "terminal_nav": float(agent_curve[-1]),
        "terminal_return": agent_return,
        "passive_terminal_nav": float(passive_curve[-1]),
        "passive_terminal_return": passive_return,
        "excess_terminal_return": agent_return - passive_return,
        "max_drawdown": mdd,
        "passive_max_drawdown": passive_mdd,
        "mdd_improvement": passive_mdd - mdd,
        "downside_deviation": float(np.std(downside, ddof=0)) if len(downside) else 0.0,
        "total_reward": float(daily["reward"].sum()),
        "alpha_reward": float(daily["alpha_reward_component"].sum()),
        "commission_reward": float(daily["commission_reward_component"].sum()),
        "mdd_reward": float(daily["mdd_reward_component"].sum()),
        "turnover_reward": float(daily["turnover_reward_component"].sum()),
        "reward_clipping": float(daily["reward_clipping_adjustment"].sum()),
        "total_turnover": float(daily["turnover"].sum()),
        "total_commission_try": float(daily["commission"].sum()),
        "trade_days": int((daily["turnover"] > 1e-12).sum()),
        "illegal_days": int((~daily["post_trade_legal"].astype(bool)).sum()),
        "action_bound_hit_fraction": float(
            np.mean([np.any(np.abs(np.asarray(action, dtype=float)) >= 0.999) for action in daily["raw_action"]])
        ),
        "mean_tpp_weight": float(daily["weight_TPP_ON"].mean()),
        "mean_heavy_count": float(daily["applied_heavy_count"].mean()),
    }


def run_model_episode(
    model: PPO,
    env: BistStressEnv,
    path: ScenarioPath,
    model_seed: int,
) -> tuple[dict[str, Any], pd.DataFrame]:
    observation, _ = env.reset(options={"scenario_path": path})
    done = False
    while not done:
        action, _ = model.predict(observation, deterministic=True)
        observation, _, terminated, truncated, _ = env.step(action)
        done = bool(terminated or truncated)
    daily = pd.DataFrame(env.history)
    path_id = f"{path.family}_{int(path.scenario_seed):06d}"
    daily.insert(0, "path_id", path_id)
    daily.insert(0, "model_seed", int(model_seed))
    metrics = _episode_metrics(daily, float(env.config["project"]["initial_nav_try"]))
    metrics.update({"path_id": path_id, "model_seed": int(model_seed)})
    metrics["success"] = bool(
        metrics["illegal_days"] == 0
        and metrics["excess_terminal_return"] >= 0.0025
        and metrics["max_drawdown"] <= metrics["passive_max_drawdown"]
    )
    return metrics, daily


def _simulate_rebalance_baseline(
    runtime: Runtime,
    path: ScenarioPath,
    target_weights: np.ndarray,
    name: str,
    rebalance_every: int,
) -> dict[str, Any]:
    cfg = runtime.config
    initial_nav = float(cfg["project"]["initial_nav_try"])
    prices = path.prices[path.lookback]
    accounting = cfg["accounting"]
    book = PortfolioBook(
        initial_nav,
        target_weights if name == "PASSIVE_NO_TRADE" else np.asarray(
            [cfg["universe"]["initial_weights"][symbol] for symbol in cfg["universe"]["tickers"] + [cfg["universe"]["tpp_symbol"]]],
            dtype=float,
        ),
        prices,
        float(accounting["buy_commission_rate"]),
        float(accounting["sell_commission_rate"]),
    )
    curve = [initial_nav]
    turnover = 0.0
    commission = 0.0
    trade_days = 0
    for day in range(path.horizon):
        prices = path.prices[path.lookback + day + 1]
        book.accrue_tpp(float(path.tpp_annual_rates[day]), int(path.calendar_accrual_days[day]))
        is_terminal = day == path.horizon - 1
        should_trade = name != "PASSIVE_NO_TRADE" and not is_terminal and (day + 1) % rebalance_every == 0
        if should_trade:
            current = book.weights(prices)
            proposed = 0.5 * float(np.abs(target_weights - current).sum())
            if proposed >= float(cfg["action"]["minimum_one_way_turnover_to_execute"]):
                result = book.rebalance(target_weights, prices)
                turnover += result.turnover
                commission += result.commission
                trade_days += 1
        curve.append(book.nav(prices))
    values = np.asarray(curve)
    return {
        "baseline": name,
        "path_id": f"{path.family}_{int(path.scenario_seed):06d}",
        "family": path.family,
        "scenario_seed": int(path.scenario_seed),
        "terminal_nav": float(values[-1]),
        "terminal_return": float(values[-1] / initial_nav - 1.0),
        "max_drawdown": _maximum_drawdown(values),
        "total_turnover": turnover,
        "total_commission_try": commission,
        "trade_days": trade_days,
    }


def _baseline_targets(runtime: Runtime) -> dict[str, np.ndarray]:
    cfg = runtime.config
    symbols = cfg["universe"]["tickers"] + [cfg["universe"]["tpp_symbol"]]
    initial = np.asarray([cfg["universe"]["initial_weights"][symbol] for symbol in symbols], dtype=float)
    downside_beta = runtime.market.model_coefficients[1]
    defensive_indices = np.argsort(downside_beta)[:4]
    defensive = np.full(17, 0.0, dtype=float)
    defensive[:-1] = 0.04666666666666667
    defensive[defensive_indices] = 0.0725
    defensive[-1] = 0.15
    constraints = ProspectusConstraints(cfg["constraints"], 16)
    constraints.require(initial)
    constraints.require(defensive)
    return {
        "PASSIVE_NO_TRADE": initial,
        "INITIAL_TARGET_WEEKLY": initial,
        "TRAIN_ONLY_DEFENSIVE_DOWNSIDE_BETA": defensive,
    }


def _confidence_interval(values: np.ndarray, rng: np.random.Generator, resamples: int = 5000) -> tuple[float, float]:
    samples = rng.choice(values, size=(resamples, len(values)), replace=True).mean(axis=1)
    return float(np.quantile(samples, 0.025)), float(np.quantile(samples, 0.975))


def _summaries(metrics: pd.DataFrame, baselines: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    seed_summary = metrics.groupby("model_seed", as_index=False).agg(
        episodes=("path_id", "count"),
        mean_terminal_return=("terminal_return", "mean"),
        mean_excess_return=("excess_terminal_return", "mean"),
        median_excess_return=("excess_terminal_return", "median"),
        mean_max_drawdown=("max_drawdown", "mean"),
        mean_mdd_improvement=("mdd_improvement", "mean"),
        success_rate=("success", "mean"),
        median_turnover=("total_turnover", "median"),
        median_trade_days=("trade_days", "median"),
        mean_total_reward=("total_reward", "mean"),
        mean_commission_try=("total_commission_try", "mean"),
        action_bound_hit_fraction=("action_bound_hit_fraction", "mean"),
    )
    family_summary = metrics.groupby("family", as_index=False).agg(
        episodes=("path_id", "count"),
        mean_terminal_return=("terminal_return", "mean"),
        mean_excess_return=("excess_terminal_return", "mean"),
        mean_mdd_improvement=("mdd_improvement", "mean"),
        success_rate=("success", "mean"),
        median_turnover=("total_turnover", "median"),
        median_trade_days=("trade_days", "median"),
        mean_total_reward=("total_reward", "mean"),
    )
    pathwise = metrics.groupby("path_id", as_index=False).agg(
        excess=("excess_terminal_return", "mean"),
        mdd_improvement=("mdd_improvement", "mean"),
    )
    rng = np.random.default_rng(20260808)
    excess_ci = _confidence_interval(pathwise["excess"].to_numpy(float), rng)
    mdd_ci = _confidence_interval(pathwise["mdd_improvement"].to_numpy(float), rng)
    signs = rng.choice(np.asarray([-1.0, 1.0]), size=(10_000, len(pathwise)))
    observed = float(pathwise["excess"].mean())
    permuted = (signs * pathwise["excess"].to_numpy(float)).mean(axis=1)
    sign_flip_p = float((1 + np.count_nonzero(permuted >= observed)) / (len(permuted) + 1))
    baseline_summary = baselines.groupby("baseline").agg(
        mean_terminal_return=("terminal_return", "mean"),
        mean_max_drawdown=("max_drawdown", "mean"),
        median_turnover=("total_turnover", "median"),
        median_trade_days=("trade_days", "median"),
    ).to_dict(orient="index")
    acceptance = {
        "episodes": int(len(metrics)),
        "unique_paths": int(metrics["path_id"].nunique()),
        "model_seeds": int(metrics["model_seed"].nunique()),
        "illegal_executed_targets": int(metrics["illegal_days"].sum()),
        "runtime_failures": 0,
        "pooled_success_rate": float(metrics["success"].mean()),
        "each_seed_success_rate": dict(zip(seed_summary["model_seed"].astype(str), seed_summary["success_rate"])),
        "family_success_rate": dict(zip(family_summary["family"], family_summary["success_rate"])),
        "mean_excess_return": observed,
        "mean_excess_return_95_ci": list(excess_ci),
        "mean_mdd_improvement": float(pathwise["mdd_improvement"].mean()),
        "mean_mdd_improvement_95_ci": list(mdd_ci),
        "paired_one_sided_sign_flip_p": sign_flip_p,
        "median_turnover": float(metrics["total_turnover"].median()),
        "median_trade_days": float(metrics["trade_days"].median()),
        "terminal_return_cvar_5": float(metrics.loc[metrics["terminal_return"] <= metrics["terminal_return"].quantile(0.05), "terminal_return"].mean()),
        "baseline_summary": baseline_summary,
    }
    acceptance["gates"] = {
        "zero_illegal_and_runtime_failures": acceptance["illegal_executed_targets"] == 0,
        "pooled_success_rate_ge_60pct": acceptance["pooled_success_rate"] >= 0.60,
        "each_seed_success_rate_ge_55pct": bool((seed_summary["success_rate"] >= 0.55).all()),
        "at_least_three_families_success_rate_ge_55pct": int((family_summary["success_rate"] >= 0.55).sum()) >= 3,
        "lower_ci_mean_excess_gt_zero": excess_ci[0] > 0.0,
        "lower_ci_mdd_improvement_ge_zero": mdd_ci[0] >= 0.0,
        "each_seed_mean_excess_gt_zero": bool((seed_summary["mean_excess_return"] > 0.0).all()),
        "median_turnover_le_2": acceptance["median_turnover"] <= 2.0,
        "median_trade_days_le_60": acceptance["median_trade_days"] <= 60,
    }
    acceptance["all_pre_registered_gates_pass"] = bool(all(acceptance["gates"].values()))
    return seed_summary, family_summary, acceptance


def _reward_summary(steps: pd.DataFrame) -> pd.DataFrame:
    components = [
        "alpha_reward_component",
        "commission_reward_component",
        "mdd_reward_component",
        "turnover_reward_component",
        "reward_clipping_adjustment",
    ]
    rows = []
    for seed_group, frame in [("ALL", steps), *[(str(seed), part) for seed, part in steps.groupby("model_seed")]]:
        for component in components:
            values = frame[component].to_numpy(float)
            rows.append(
                {
                    "model_seed": seed_group,
                    "component": component,
                    "sum": float(values.sum()),
                    "mean": float(values.mean()),
                    "positive_days": int(np.count_nonzero(values > 1e-12)),
                    "negative_days": int(np.count_nonzero(values < -1e-12)),
                    "zero_days": int(np.count_nonzero(np.abs(values) <= 1e-12)),
                }
            )
    return pd.DataFrame(rows)


def _trade_blotter(steps: pd.DataFrame, symbols: list[str]) -> pd.DataFrame:
    frames = []
    identifying = [
        "model_seed", "path_id", "family", "scenario_seed", "scenario_day", "date",
        "action_status", "execution_policy",
    ]
    for symbol in symbols:
        trade_column = f"trade_try_{symbol}"
        pre_weight_column = f"pre_weight_{symbol}"
        target_weight_column = f"target_weight_{symbol}"
        weight_column = f"weight_{symbol}"
        frame = steps[identifying + [trade_column, pre_weight_column, target_weight_column, weight_column]].copy()
        frame["instrument"] = symbol
        frame["asset_type"] = "TPP" if symbol == symbols[-1] else "EQUITY"
        frame["trade_try"] = frame.pop(trade_column)
        frame["pre_trade_weight"] = frame.pop(pre_weight_column)
        frame["target_weight"] = frame.pop(target_weight_column)
        frame["post_trade_weight"] = frame.pop(weight_column)
        threshold = 1e-9
        frame["side"] = np.select(
            [frame["trade_try"] > threshold, frame["trade_try"] < -threshold],
            ["BUY", "SELL"],
            default="HOLD",
        )
        frame["executed"] = frame["trade_try"].abs() > threshold
        frames.append(frame)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def evaluate_models(config_path: str, model_paths: list[str], output_name: str | None = None) -> Path:
    runtime = build_runtime(config_path)
    cfg = runtime.config
    paths = runtime.scenarios.frozen_paths("test")
    output_name = output_name or f"locked_test_{datetime.now():%Y%m%d_%H%M%S}"
    output_dir = Path(cfg["paths"]["report_root"]) / output_name
    output_dir.mkdir(parents=True, exist_ok=False)
    models = []
    selected = []
    for model_path in model_paths:
        path = Path(model_path).resolve()
        run_dir = path.parent.parent if path.parent.name == "best_model" else path.parent
        manifest = json.loads((run_dir / "run_manifest.json").read_text(encoding="utf-8"))
        seed = int(manifest["model_seed"])
        models.append((seed, PPO.load(path, device=cfg["ppo"]["device"])))
        selected.append({"model_seed": seed, "model_path": str(path), "run": run_dir.name})

    baseline_rows = []
    targets = _baseline_targets(runtime)
    for path in paths:
        for name, target in targets.items():
            baseline_rows.append(
                _simulate_rebalance_baseline(runtime, path, target, name, 5)
            )
    baselines = pd.DataFrame(baseline_rows)

    metric_rows: list[dict[str, Any]] = []
    daily_frames: list[pd.DataFrame] = []
    for seed, model in models:
        env = BistStressEnv(cfg, runtime.scenarios, split="test")
        for index, path in enumerate(paths, start=1):
            metrics, daily = run_model_episode(model, env, path, seed)
            metric_rows.append(metrics)
            daily_frames.append(daily)
            if index % 16 == 0:
                print(f"EVALUATION_PROGRESS seed={seed} {index}/{len(paths)}", flush=True)
        env.close()
    metrics = pd.DataFrame(metric_rows)
    steps = pd.concat(daily_frames, ignore_index=True)
    trades = _trade_blotter(
        steps,
        list(cfg["universe"]["tickers"]) + [str(cfg["universe"]["tpp_symbol"])],
    )
    rewards = _reward_summary(steps)
    seed_summary, family_summary, acceptance = _summaries(metrics, baselines)

    metrics.to_parquet(output_dir / "metrics_by_path.parquet", index=False)
    steps.to_parquet(output_dir / "step_log.parquet", index=False)
    trades.to_parquet(output_dir / "trade_blotter.parquet", index=False)
    baselines.to_parquet(output_dir / "baselines_by_path.parquet", index=False)
    metrics.to_csv(output_dir / "metrics_by_path.csv", index=False)
    steps.to_csv(output_dir / "step_log.csv.gz", index=False, compression="gzip")
    trades.to_csv(output_dir / "trade_blotter.csv.gz", index=False, compression="gzip")
    example_ids = (
        metrics[metrics["model_seed"] == metrics["model_seed"].max()]
        .sort_values(["family", "scenario_seed"])
        .groupby("family", as_index=False)
        .first()["path_id"]
    )
    steps[(steps["model_seed"] == metrics["model_seed"].max()) & steps["path_id"].isin(example_ids)].to_csv(
        output_dir / "ornek_gunluk_loglar.csv", index=False
    )
    seed_summary.to_csv(output_dir / "seed_summary.csv", index=False)
    family_summary.to_csv(output_dir / "family_summary.csv", index=False)
    rewards.to_csv(output_dir / "reward_summary.csv", index=False)
    (output_dir / "evaluation_summary.json").write_text(
        json.dumps(acceptance, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    manifest = {
        "evaluated_at": datetime.now().isoformat(timespec="seconds"),
        "config": str(Path(config_path).resolve()),
        "selected_models": selected,
        "frozen_test_paths": [
            {"path_id": f"{path.family}_{int(path.scenario_seed):06d}", "family": path.family, "seed": path.scenario_seed}
            for path in paths
        ],
        "test_tuning_allowed": False,
    }
    (output_dir / "evaluation_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    build_evaluation_dashboard(output_dir, metrics, steps, seed_summary, family_summary, rewards, baselines)
    print(json.dumps(acceptance, indent=2, ensure_ascii=False), flush=True)
    print(f"EVALUATION_COMPLETE {output_dir}", flush=True)
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--models", nargs="+", required=True)
    parser.add_argument("--output-name")
    args = parser.parse_args()
    evaluate_models(args.config, args.models, args.output_name)


if __name__ == "__main__":
    main()
