from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd
from stable_baselines3 import PPO

from .env import BistStressEnv
from .evaluate import _baseline_targets, _simulate_rebalance_baseline, _trade_blotter, run_model_episode
from .evidence import sha256_file, write_hash_manifest
from .runtime import build_runtime


def evaluate_validation_pilot(
    config_path: str,
    model_paths: list[str],
    output_name: str,
) -> Path:
    runtime = build_runtime(config_path)
    paths = runtime.scenarios.frozen_paths("validation")
    output = Path(runtime.config["paths"]["report_root"]) / output_name
    output.mkdir(parents=True, exist_ok=False)
    metrics_rows: list[dict[str, Any]] = []
    daily_frames: list[pd.DataFrame] = []
    selected: list[dict[str, Any]] = []
    for model_path_text in model_paths:
        model_path = Path(model_path_text).resolve()
        run_dir = model_path.parent.parent if model_path.parent.name == "best_model" else model_path.parent
        manifest = json.loads((run_dir / "run_manifest.json").read_text(encoding="utf-8"))
        seed = int(manifest["model_seed"])
        model = PPO.load(model_path, device="cpu")
        selected.append(
            {
                "model_seed": seed,
                "path": str(model_path),
                "bytes": int(model_path.stat().st_size),
                "sha256": sha256_file(model_path),
            }
        )
        env = BistStressEnv(runtime.config, runtime.scenarios, split="validation")
        for index, path in enumerate(paths, start=1):
            metrics, daily = run_model_episode(model, env, path, seed)
            metrics_rows.append(metrics)
            daily_frames.append(daily)
            if index % 16 == 0:
                print(f"V21_VALIDATION_PROGRESS seed={seed} {index}/{len(paths)}", flush=True)
        env.close()

    metrics = pd.DataFrame(metrics_rows)
    daily = pd.concat(daily_frames, ignore_index=True)
    static_target = _baseline_targets(runtime)["TRAIN_ONLY_DEFENSIVE_DOWNSIDE_BETA"]
    static = pd.DataFrame(
        [
            _simulate_rebalance_baseline(
                runtime,
                path,
                static_target,
                "TRAIN_ONLY_DEFENSIVE_DOWNSIDE_BETA",
                5,
            )
            for path in paths
        ]
    )
    summary = metrics.groupby("model_seed", as_index=False).agg(
        episodes=("path_id", "count"),
        mean_terminal_return=("terminal_return", "mean"),
        mean_excess_return=("excess_terminal_return", "mean"),
        mean_max_drawdown=("max_drawdown", "mean"),
        mean_mdd_improvement=("mdd_improvement", "mean"),
        success_rate=("success", "mean"),
        median_turnover=("total_turnover", "median"),
        median_trade_days=("trade_days", "median"),
        mean_commission_try=("total_commission_try", "mean"),
        mean_total_reward=("total_reward", "mean"),
        action_bound_hit_fraction=("action_bound_hit_fraction", "mean"),
    )
    policy_by_path = metrics.groupby("path_id", as_index=False).agg(
        policy_return=("terminal_return", "mean"), policy_mdd=("max_drawdown", "mean")
    )
    paired = policy_by_path.merge(
        static[["path_id", "terminal_return", "max_drawdown"]], on="path_id", validate="one_to_one"
    )
    paired["policy_minus_static_return"] = paired["policy_return"] - paired["terminal_return"]
    paired["policy_minus_static_mdd_improvement"] = paired["max_drawdown"] - paired["policy_mdd"]

    timing = {
        "schema_version": "v21_precommitted_validation_audit_v1",
        "episodes": int(len(metrics)),
        "unique_paths": int(metrics["path_id"].nunique()),
        "model_seeds": sorted(metrics["model_seed"].astype(int).unique().tolist()),
        "day_rows": int(len(daily)),
        "post_trade_illegal_days": int((~daily["post_trade_legal"].astype(bool)).sum()),
        "same_close_reactive_trigger_days": int(daily["forced_trigger_uses_execution_close"].astype(bool).sum()),
        "precommitted_target_fraction": float(daily["decision_target_precommitted"].astype(bool).mean()),
        "pre_trade_drift_illegal_days": int((~daily["pre_trade_legal"].astype(bool)).sum()),
        "executed_trade_days": int((daily["turnover"] > 1e-12).sum()),
        "final_session_executed_trade_days": int(
            (daily["final_session"].astype(bool) & (daily["turnover"] > 1e-12)).sum()
        ),
        "test_paths_accessed": False,
        "validation_seed_base": int(runtime.config["scenario_generator"]["validation_seed_base"]),
        "new_test_seed_base_reserved": int(runtime.config["scenario_generator"]["test_seed_base"]),
    }
    metrics.to_csv(output / "validation_metrics.csv", index=False)
    metrics.to_parquet(output / "validation_metrics.parquet", index=False)
    daily.to_parquet(output / "validation_daily.parquet", index=False)
    symbols = runtime.config["universe"]["tickers"] + [runtime.config["universe"]["tpp_symbol"]]
    _trade_blotter(daily, symbols).to_parquet(output / "validation_full_blotter.parquet", index=False)
    summary.to_csv(output / "validation_seed_summary.csv", index=False)
    static.to_csv(output / "static_defensive_baseline.csv", index=False)
    paired.to_csv(output / "policy_vs_static_by_path.csv", index=False)
    (output / "execution_timing_audit.json").write_text(
        json.dumps(timing, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    manifest = {
        "config": str(Path(config_path).resolve()),
        "config_sha256": sha256_file(config_path),
        "selected_models": selected,
        "split": "validation",
        "test_paths_accessed": False,
    }
    (output / "validation_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    write_hash_manifest(
        output / "output_hashes.json",
        files=[path for path in output.iterdir() if path.is_file() and path.name != "output_hashes.json"],
        paths=paths,
        metadata={"test_paths_accessed": False, "split": "validation"},
    )
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--models", nargs="+", required=True)
    parser.add_argument("--output-name", required=True)
    args = parser.parse_args()
    print(evaluate_validation_pilot(args.config, args.models, args.output_name))


if __name__ == "__main__":
    main()
