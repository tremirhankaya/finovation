from __future__ import annotations

import argparse
import copy
import json
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yaml
from stable_baselines3 import PPO

from .config import load_config
from .env import BistStressEnv
from .evaluate import _confidence_interval, run_model_episode
from .evidence import sha256_file
from .runtime import build_runtime
from .train import train


VARIANTS = ("V1", "V2", "V3")


def _serializable_config(config: dict[str, Any]) -> dict[str, Any]:
    return {key: copy.deepcopy(value) for key, value in config.items() if not key.startswith("_")}


def _variant_config(base: dict[str, Any], variant: str) -> dict[str, Any]:
    if variant not in VARIANTS:
        raise ValueError(f"Unknown controlled variant: {variant}")
    config = _serializable_config(base)
    config["project"]["name"] = f"bist16_stress_ppo_controlled_{variant.lower()}"
    config["experiments"]["controlled_variant"] = variant
    if variant in {"V1", "V2"}:
        config["observation"]["version"] = "state_v2"
        config["observation"]["dimension"] = 112
    else:
        config["observation"]["version"] = "state_v3"
        config["observation"]["dimension"] = 131
    if variant == "V1":
        config["reward"]["version"] = "reward_v1_relative_return_and_execution_only"
        config["reward"]["incremental_running_mdd_coefficient"] = 0.0
        config["reward"]["turnover_coefficient"] = 0.0
    else:
        config["reward"]["version"] = "reward_v2"
    return config


def _write_variant_configs(base_config_path: str, root: Path) -> dict[str, Path]:
    base = load_config(base_config_path)
    config_root = root / "configs"
    config_root.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for variant in VARIANTS:
        path = config_root / f"controlled_{variant.lower()}.yaml"
        path.write_text(
            yaml.safe_dump(_variant_config(base, variant), sort_keys=False, allow_unicode=True),
            encoding="utf-8",
        )
        paths[variant] = path
    return paths


def _evaluate_validation(
    config_paths: dict[str, Path],
    model_runs: dict[tuple[str, int], Path],
    output: Path,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    metric_rows: list[dict[str, Any]] = []
    status_rows: list[dict[str, Any]] = []
    for variant in VARIANTS:
        runtime = build_runtime(str(config_paths[variant]))
        paths = runtime.scenarios.frozen_paths("validation")
        for (candidate_variant, seed), run_dir in model_runs.items():
            if candidate_variant != variant:
                continue
            model_path = run_dir / "best_model" / "best_model.zip"
            if not model_path.exists():
                model_path = run_dir / "final_model.zip"
            model = PPO.load(model_path, device=runtime.config["ppo"]["device"])
            env = BistStressEnv(runtime.config, runtime.scenarios, split="validation")
            for index, path in enumerate(paths, start=1):
                metrics, daily = run_model_episode(model, env, path, seed)
                metrics["variant"] = variant
                metric_rows.append(metrics)
                counts = daily["action_status"].value_counts()
                for status, count in counts.items():
                    status_rows.append(
                        {
                            "variant": variant,
                            "model_seed": seed,
                            "path_id": metrics["path_id"],
                            "action_status": status,
                            "days": int(count),
                        }
                    )
                if index % 16 == 0:
                    print(
                        f"CONTROLLED_VALIDATION_PROGRESS variant={variant} seed={seed} {index}/{len(paths)}",
                        flush=True,
                    )
            env.close()
    metrics = pd.DataFrame(metric_rows)
    statuses = pd.DataFrame(status_rows)
    summary = metrics.groupby(["variant", "model_seed"], as_index=False).agg(
        episodes=("path_id", "count"),
        mean_terminal_return=("terminal_return", "mean"),
        mean_excess_return=("excess_terminal_return", "mean"),
        mean_max_drawdown=("max_drawdown", "mean"),
        mean_mdd_improvement=("mdd_improvement", "mean"),
        success_rate=("success", "mean"),
        median_turnover=("total_turnover", "median"),
        median_trade_days=("trade_days", "median"),
        mean_total_reward=("total_reward", "mean"),
        action_bound_hit_fraction=("action_bound_hit_fraction", "mean"),
    )

    pivot_return = metrics.pivot(index=["model_seed", "path_id"], columns="variant", values="terminal_return")
    pivot_mdd = metrics.pivot(index=["model_seed", "path_id"], columns="variant", values="max_drawdown")
    effects = pd.DataFrame(index=pivot_return.index)
    effects["V2_minus_V1_terminal_return"] = pivot_return["V2"] - pivot_return["V1"]
    effects["V3_minus_V2_terminal_return"] = pivot_return["V3"] - pivot_return["V2"]
    effects["V2_minus_V1_mdd_improvement"] = pivot_mdd["V1"] - pivot_mdd["V2"]
    effects["V3_minus_V2_mdd_improvement"] = pivot_mdd["V2"] - pivot_mdd["V3"]
    effects = effects.reset_index()
    rng = np.random.default_rng(20260808)
    effect_summary: dict[str, Any] = {}
    for column in effects.columns[2:]:
        pathwise = effects.groupby("path_id")[column].mean().to_numpy(float)
        effect_summary[column] = {
            "mean": float(pathwise.mean()),
            "median": float(np.median(pathwise)),
            "path_level_95_ci": list(_confidence_interval(pathwise, rng)),
            "positive_path_fraction": float(np.mean(pathwise > 0.0)),
        }

    metrics.to_parquet(output / "controlled_validation_metrics.parquet", index=False)
    metrics.to_csv(output / "controlled_validation_metrics.csv", index=False)
    statuses.to_csv(output / "controlled_action_status_counts.csv", index=False)
    summary.to_csv(output / "controlled_variant_seed_summary.csv", index=False)
    effects.to_csv(output / "controlled_paired_effects.csv", index=False)
    (output / "controlled_effect_summary.json").write_text(
        json.dumps(effect_summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return summary, effects, effect_summary


def run_controlled_pilots(
    base_config_path: str,
    *,
    seeds: list[int],
    timesteps: int | None = None,
    batch_name: str | None = None,
) -> Path:
    base = load_config(base_config_path)
    batch_name = batch_name or f"controlled_v1_v2_v3_{datetime.now():%Y%m%d_%H%M%S}"
    root = Path(base["paths"]["artifacts_dir"]) / "controlled_experiments" / batch_name
    root.mkdir(parents=True, exist_ok=False)
    config_paths = _write_variant_configs(base_config_path, root)
    steps = int(timesteps or base["experiments"]["pilot_timesteps"])
    model_runs: dict[tuple[str, int], Path] = {}
    registry: dict[str, Any] = {
        "schema_version": "controlled_v1_v2_v3_v1",
        "batch_name": batch_name,
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "base_config": str(Path(base_config_path).resolve()),
        "base_config_sha256": sha256_file(base_config_path),
        "variants": list(VARIANTS),
        "model_seeds": [int(seed) for seed in seeds],
        "timesteps_per_run": steps,
        "validation_paths_per_run": int(base["experiments"]["validation_episodes"]),
        "test_paths_accessed": False,
        "runs": [],
    }
    (root / "experiment_registry.json").write_text(
        json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    for variant in VARIANTS:
        for seed in seeds:
            run_name = f"controlled_{variant.lower()}_seed{seed}_{batch_name}"
            print(f"CONTROLLED_TRAIN_START variant={variant} seed={seed}", flush=True)
            run_dir = train(
                str(config_paths[variant]),
                steps,
                seed=int(seed),
                run_name=run_name,
            )
            model_runs[(variant, int(seed))] = run_dir
            registry["runs"].append(
                {
                    "variant": variant,
                    "model_seed": int(seed),
                    "run_dir": str(run_dir.resolve()),
                    "config": str(config_paths[variant].resolve()),
                    "config_sha256": sha256_file(config_paths[variant]),
                    "best_model": str((run_dir / "best_model" / "best_model.zip").resolve()),
                }
            )
            (root / "experiment_registry.json").write_text(
                json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8"
            )
    summary, _effects, effect_summary = _evaluate_validation(config_paths, model_runs, root)
    registry["finished_at"] = datetime.now().isoformat(timespec="seconds")
    registry["status"] = "complete"
    registry["test_paths_accessed"] = False
    registry["effect_summary"] = effect_summary
    (root / "experiment_registry.json").write_text(
        json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    overall = summary.groupby("variant", as_index=False).agg(
        mean_excess_return=("mean_excess_return", "mean"),
        mean_mdd_improvement=("mean_mdd_improvement", "mean"),
        mean_success_rate=("success_rate", "mean"),
        median_turnover=("median_turnover", "median"),
        action_bound_hit_fraction=("action_bound_hit_fraction", "mean"),
    )
    overall.to_csv(root / "controlled_variant_overall_summary.csv", index=False)
    print(f"CONTROLLED_EXPERIMENT_COMPLETE {root}", flush=True)
    return root


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--seeds", nargs="+", type=int, default=[42, 31415])
    parser.add_argument("--timesteps", type=int)
    parser.add_argument("--batch-name")
    args = parser.parse_args()
    run_controlled_pilots(
        args.config,
        seeds=args.seeds,
        timesteps=args.timesteps,
        batch_name=args.batch_name,
    )


if __name__ == "__main__":
    main()
