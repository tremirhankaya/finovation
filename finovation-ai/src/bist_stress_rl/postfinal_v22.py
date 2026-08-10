from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from stable_baselines3 import PPO

from .analyze_pilot_v22 import _episode_metrics, _quality_gates
from .config import load_config
from .env_v22 import BistStressEnvV22
from .evaluate_v22 import evaluate_v22, run_episode
from .historical_v22 import evaluate_historical
from .runtime_v22 import build_runtime_v22


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def _log(path: Path, event: str, **fields: object) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": _now(), "event": event, **fields}, ensure_ascii=False) + "\n")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _candidate_files(run: dict) -> list[dict]:
    run_dir = Path(run["run_dir"])
    manifest = json.loads((run_dir / "run_manifest.json").read_text(encoding="utf-8"))
    requested = int(manifest["timesteps_requested"])
    candidates = []
    final_model = Path(run["model_path"])
    candidates.append({"kind": "final", "timestep": requested, "model_path": str(final_model.resolve())})
    best = run_dir / "best_model" / "best_model.zip"
    if best.exists():
        candidates.append({"kind": "sb3_best_reward", "timestep": -1, "model_path": str(best.resolve())})
    for checkpoint in sorted((run_dir / "checkpoints").glob("*.zip")):
        match = re.search(r"_(\d+)_steps", checkpoint.name)
        candidates.append(
            {
                "kind": "checkpoint",
                "timestep": int(match.group(1)) if match else -1,
                "model_path": str(checkpoint.resolve()),
            }
        )
    unique = []
    seen = set()
    for candidate in candidates:
        digest = _sha256(Path(candidate["model_path"]))
        if digest in seen:
            continue
        seen.add(digest)
        candidate["sha256"] = digest
        unique.append(candidate)
    return unique


def _score_candidate(config_path: str, model_path: str, seed: int) -> dict:
    runtime = build_runtime_v22(config_path, write_contracts=False)
    paths = runtime.scenarios.frozen_paths("validation")
    model = PPO.load(model_path, device=runtime.config["ppo"]["device"])
    env = BistStressEnvV22(runtime.config, runtime.scenarios, split="validation")
    rows = []
    for path in paths:
        metrics, _ = run_episode(model, env, path, seed)
        rows.append(metrics)
    env.close()
    frame = _episode_metrics(pd.DataFrame(rows))
    return {
        "episodes": int(len(frame)),
        "mean_excess_return": float(frame["excess_terminal_return"].mean()),
        "median_excess_return": float(frame["excess_terminal_return"].median()),
        "mean_mdd_improvement": float(frame["mdd_improvement"].mean()),
        "return_success_rate": float(frame["return_success"].mean()),
        "mdd_success_rate": float(frame["mdd_success"].mean()),
        "dual_success_rate": float(frame["dual_success"].mean()),
        "median_turnover": float(frame["realized_turnover"].median()),
        "mean_commission_try": float(frame["total_commission_try"].mean()),
        "illegal_days": int(frame["illegal_days"].sum()),
        "mean_total_reward": float(frame["total_reward"].mean()),
        "utility": float(frame["excess_terminal_return"].mean() + 0.5 * frame["mdd_improvement"].mean()),
    }


def _select_checkpoints(final_runs: list[dict], pipeline: Path, coordinator: dict, coordinator_path: Path, log_path: Path) -> tuple[pd.DataFrame, list[dict], dict]:
    candidates = []
    for run in final_runs:
        for candidate in _candidate_files(run):
            candidates.append({**candidate, "seed": int(run["seed"]), "run_name": run["run_name"], "config": run["config"], "run_dir": run["run_dir"]})
    rows = []
    coordinator["checkpoint_candidates_total"] = len(candidates)
    coordinator["checkpoint_candidates_completed"] = 0
    for index, candidate in enumerate(candidates, start=1):
        coordinator["current_stage"] = "checkpoint_validation"
        coordinator["current_item"] = {**candidate, "index": index}
        _write_json(coordinator_path, coordinator)
        metrics = _score_candidate(candidate["config"], candidate["model_path"], candidate["seed"])
        row = {**candidate, **metrics}
        rows.append(row)
        pd.DataFrame(rows).to_csv(pipeline / "checkpoint_validation_scores.csv", index=False)
        coordinator["checkpoint_candidates_completed"] = len(rows)
        _write_json(coordinator_path, coordinator)
        _log(log_path, "checkpoint_validation_complete", seed=candidate["seed"], kind=candidate["kind"], timestep=candidate["timestep"], utility=metrics["utility"])
    scores = pd.DataFrame(rows)
    eligible = scores[scores["illegal_days"] == 0].copy()
    selected_by_seed = []
    for seed, group in eligible.groupby("seed"):
        chosen = group.sort_values(
            ["utility", "dual_success_rate", "mean_excess_return", "median_turnover"],
            ascending=[False, False, False, True],
        ).iloc[0]
        selected_by_seed.append(chosen.to_dict())
    selected_by_seed = sorted(selected_by_seed, key=lambda row: int(row["seed"]))
    deployment = sorted(
        selected_by_seed,
        key=lambda row: (row["utility"], row["dual_success_rate"], row["mean_excess_return"], -row["median_turnover"]),
        reverse=True,
    )[0]
    decision = {
        "selected_before_test_at": _now(),
        "selection_data": "frozen_validation_only",
        "rule": "per seed highest utility; deployment seed highest utility, then dual success, excess return, lower turnover",
        "selected_by_seed": selected_by_seed,
        "deployment_checkpoint": deployment,
        "test_was_not_read_for_selection": True,
    }
    _write_json(pipeline / "final_checkpoint_selection_pretest.json", decision)
    return scores, selected_by_seed, deployment


def _extend_if_below_gate(
    root: Path,
    pipeline: Path,
    selected_by_seed: list[dict],
    deployment: dict,
    coordinator: dict,
    coordinator_path: Path,
    log_path: Path,
) -> tuple[list[dict], dict, dict | None]:
    gate_pass = bool(
        float(deployment["mean_excess_return"]) > 0.0
        and float(deployment["mean_mdd_improvement"]) > 0.0
        and float(deployment["dual_success_rate"]) >= 0.50
    )
    if gate_pass:
        _write_json(
            pipeline / "controlled_extension_result.json",
            {"required": False, "reason": "final validation performance gate passed", "deployment": deployment},
        )
        return selected_by_seed, deployment, None

    coordinator["current_stage"] = "controlled_training_extension"
    coordinator["current_item"] = {"seed": int(deployment["seed"]), "reason": "validation gate below target"}
    _write_json(coordinator_path, coordinator)
    config = load_config(deployment["config"])
    additional_steps = max(
        int(config["experiments"]["pilot_timesteps"]),
        int(config["experiments"]["final_timesteps_per_seed"]) // 2,
    )
    run_name = f"experimental_extension_p1_seed{int(deployment['seed'])}_{datetime.now():%Y%m%d_%H%M%S}"
    batch_log = pipeline / f"{run_name}.log"
    command = [
        sys.executable,
        "-m",
        "bist_stress_rl.train_v22",
        "--config",
        deployment["config"],
        "--timesteps",
        str(additional_steps),
        "--seed",
        str(int(deployment["seed"])),
        "--vec-env",
        "SubprocVecEnv",
        "--run-name",
        run_name,
        "--resume",
        deployment["model_path"],
    ]
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(root / "src")
    _log(log_path, "controlled_extension_started", seed=int(deployment["seed"]), steps=additional_steps, run_name=run_name)
    with batch_log.open("w", encoding="utf-8") as handle:
        result = subprocess.run(command, cwd=root, env=environment, stdout=handle, stderr=subprocess.STDOUT, text=True, check=False)
    payload: dict = {
        "required": True,
        "run_name": run_name,
        "seed": int(deployment["seed"]),
        "additional_steps": additional_steps,
        "exit_code": int(result.returncode),
        "previous_deployment": deployment,
    }
    if result.returncode != 0:
        payload["adopted"] = False
        payload["reason"] = "extension training failed; retained frozen pre-test checkpoint"
        _write_json(pipeline / "controlled_extension_result.json", payload)
        _log(log_path, "controlled_extension_failed", exit_code=int(result.returncode))
        return selected_by_seed, deployment, payload
    run_dir = root / "artifacts_v22" / "p1_scenario_conditioned" / "runs" / run_name
    manifest = json.loads((run_dir / "run_manifest.json").read_text(encoding="utf-8"))
    extended_model = manifest["model_path"]
    metrics = _score_candidate(deployment["config"], extended_model, int(deployment["seed"]))
    extended = {
        **deployment,
        **metrics,
        "kind": "controlled_extension",
        "timestep": int(manifest["timesteps_requested"]),
        "model_path": extended_model,
        "run_name": run_name,
        "run_dir": str(run_dir.resolve()),
        "sha256": _sha256(Path(extended_model)),
    }
    adopted = bool(
        int(extended["illegal_days"]) == 0
        and (
            float(extended["utility"]),
            float(extended["dual_success_rate"]),
            float(extended["mean_excess_return"]),
        )
        > (
            float(deployment["utility"]),
            float(deployment["dual_success_rate"]),
            float(deployment["mean_excess_return"]),
        )
    )
    payload.update({"extended_candidate": extended, "adopted": adopted})
    if adopted:
        selected_by_seed = [extended if int(row["seed"]) == int(extended["seed"]) else row for row in selected_by_seed]
        deployment = extended
    _write_json(pipeline / "controlled_extension_result.json", payload)
    _log(log_path, "controlled_extension_complete", adopted=adopted, utility=float(extended["utility"]))
    return selected_by_seed, deployment, payload


def _final_evaluations(selected_by_seed: list[dict], coordinator: dict, coordinator_path: Path, log_path: Path) -> tuple[list[dict], list[dict]]:
    test_jobs = []
    historical_jobs = []
    for index, selected in enumerate(selected_by_seed, start=1):
        seed = int(selected["seed"])
        coordinator["current_stage"] = "frozen_test"
        coordinator["current_item"] = {"seed": seed, "index": index, "total": len(selected_by_seed)}
        _write_json(coordinator_path, coordinator)
        test_name = f"final_frozen_test_seed{seed}_{datetime.now():%Y%m%d_%H%M%S}"
        test_output = evaluate_v22(selected["config"], selected["model_path"], output_name=test_name, split="test")
        test_jobs.append({**selected, "output_dir": str(test_output.resolve()), "model_id": "P1_SCENARIO_CONDITIONED"})
        _log(log_path, "final_frozen_test_complete", seed=seed, output_dir=str(test_output.resolve()))
        coordinator["current_stage"] = "final_historical_replay"
        _write_json(coordinator_path, coordinator)
        historical_name = f"final_historical_seed{seed}_{datetime.now():%Y%m%d_%H%M%S}"
        historical_output = evaluate_historical(selected["config"], selected["model_path"], historical_name)
        historical_jobs.append({**selected, "output_dir": str(historical_output.resolve()), "model_id": "P1_SCENARIO_CONDITIONED"})
        _log(log_path, "final_historical_complete", seed=seed, output_dir=str(historical_output.resolve()))
    return test_jobs, historical_jobs


def _aggregate_jobs(jobs: list[dict], file_name: str) -> pd.DataFrame:
    frames = []
    for job in jobs:
        frame = pd.read_parquet(Path(job["output_dir"]) / file_name)
        frame["selected_checkpoint"] = job["model_path"]
        frames.append(frame)
    return pd.concat(frames, ignore_index=True)


def _summary(episodes: pd.DataFrame) -> pd.DataFrame:
    episodes = _episode_metrics(episodes)
    return (
        episodes.groupby(["model_seed", "family"], as_index=False)
        .agg(
            episodes=("path_id", "count"),
            mean_terminal_return=("terminal_return", "mean"),
            mean_passive_return=("passive_terminal_return", "mean"),
            mean_excess_return=("excess_terminal_return", "mean"),
            median_excess_return=("excess_terminal_return", "median"),
            mean_mdd=("max_drawdown", "mean"),
            mean_passive_mdd=("passive_max_drawdown", "mean"),
            mean_mdd_improvement=("mdd_improvement", "mean"),
            return_success_rate=("return_success", "mean"),
            mdd_success_rate=("mdd_success", "mean"),
            dual_success_rate=("dual_success", "mean"),
            median_turnover=("realized_turnover", "median"),
            mean_commission_try=("total_commission_try", "mean"),
            mean_total_reward=("total_reward", "mean"),
            illegal_days=("illegal_days", "sum"),
        )
    )


def _training_curves(final_runs: list[dict]) -> tuple[pd.DataFrame, pd.DataFrame]:
    progress_frames = []
    episode_frames = []
    for run in final_runs:
        run_dir = Path(run["run_dir"])
        progress = pd.read_csv(run_dir / "progress.csv")
        progress["model_seed"] = int(run["seed"])
        progress_frames.append(progress)
        episode = pd.read_csv(run_dir / "episode_summary.csv")
        episode["model_seed"] = int(run["seed"])
        episode["episode_index"] = np.arange(1, len(episode) + 1)
        episode["reward_moving_average_100"] = episode["total_reward"].rolling(100, min_periods=10).mean()
        episode["return_moving_average_100"] = episode["final_return"].rolling(100, min_periods=10).mean()
        episode_frames.append(episode)
    return pd.concat(progress_frames, ignore_index=True), pd.concat(episode_frames, ignore_index=True)


def _plots(output: Path, test_episodes: pd.DataFrame, test_daily: pd.DataFrame, test_trades: pd.DataFrame, historical_daily: pd.DataFrame, test_summary: pd.DataFrame, checkpoint_scores: pd.DataFrame, training_episodes: pd.DataFrame) -> None:
    plot_dir = output / "plots"
    plot_dir.mkdir(parents=True, exist_ok=True)

    def save(fig: plt.Figure, name: str) -> None:
        fig.tight_layout()
        fig.savefig(plot_dir / name, dpi=170)
        plt.close(fig)

    for family in ["S1", "S2"]:
        family_rows = test_episodes[test_episodes["family"] == family]
        example_row = family_rows.iloc[0]
        example_id = str(example_row["path_id"])
        example_seed = int(example_row["model_seed"])
        daily = test_daily[
            (test_daily["family"] == family)
            & (test_daily["path_id"] == example_id)
            & (test_daily["model_seed"] == example_seed)
        ]
        fig, ax = plt.subplots(figsize=(11, 5))
        ax.plot(daily["scenario_day"], daily["nav"], label="Ajan")
        ax.plot(daily["scenario_day"], daily["passive_nav"], label="Pasif")
        ax.set_title(f"{family} Örnek Yol: Portföy Değeri")
        ax.legend(); ax.grid(alpha=0.25); save(fig, f"test_{family.lower()}_nav.png")

        fig, ax = plt.subplots(figsize=(11, 5))
        ax.plot(daily["scenario_day"], daily["agent_drawdown"], label="Ajan DD")
        ax.plot(daily["scenario_day"], daily["passive_drawdown"], label="Pasif DD")
        ax.set_title(f"{family} Örnek Yol: Drawdown")
        ax.legend(); ax.grid(alpha=0.25); save(fig, f"test_{family.lower()}_drawdown.png")

        components = ["reward_relative", "reward_mdd_absolute", "reward_mdd_relative", "reward_target_change"]
        fig, ax = plt.subplots(figsize=(11, 5))
        for component in components:
            ax.plot(daily["scenario_day"], daily[component], label=component)
        ax.set_title(f"{family} Örnek Yol: Günlük Reward Bileşenleri")
        ax.legend(fontsize=8); ax.grid(alpha=0.25); save(fig, f"test_{family.lower()}_reward_components.png")

        fig, ax = plt.subplots(figsize=(11, 5))
        ax.bar(daily["scenario_day"], daily["excess_log_return"])
        ax.axhline(0, color="black", linewidth=0.8)
        ax.set_title(f"{family} Örnek Yol: Günlük Pasife Göre Log Getiri")
        ax.grid(axis="y", alpha=0.25); save(fig, f"test_{family.lower()}_daily_excess.png")

        weight_cols = [column for column in daily.columns if column.startswith("weight_")]
        fig, ax = plt.subplots(figsize=(12, 6))
        ax.stackplot(daily["scenario_day"], *[daily[column] for column in weight_cols], labels=[c.removeprefix("weight_") for c in weight_cols])
        ax.set_ylim(0, 1); ax.set_title(f"{family} Örnek Yol: Günlük Kesirli Dağılım")
        ax.legend(ncol=3, fontsize=6, loc="upper left", bbox_to_anchor=(1.01, 1)); save(fig, f"test_{family.lower()}_allocation.png")

        fig, ax = plt.subplots(figsize=(11, 4))
        ax.plot(daily["scenario_day"], 100.0 * daily["weight_TPP_ON"], label="Gerçekleşen TPP")
        ax.plot(daily["scenario_day"], 100.0 * daily["target_weight_TPP_ON"], linestyle="--", label="Hedef TPP")
        ax.axhline(5.0, color="red", linewidth=0.8); ax.axhline(15.0, color="red", linewidth=0.8)
        ax.set_title(f"{family} Örnek Yol: TPP Ağırlığı (%)"); ax.legend(); ax.grid(alpha=0.25); save(fig, f"test_{family.lower()}_tpp_weight.png")

        fig, ax1 = plt.subplots(figsize=(11, 5))
        ax1.bar(daily["scenario_day"], daily["realized_turnover"], alpha=0.55, label="Turnover")
        ax2 = ax1.twinx(); ax2.plot(daily["scenario_day"], daily["commission"], color="red", label="Komisyon")
        ax1.set_title(f"{family} Örnek Yol: Turnover ve Komisyon"); save(fig, f"test_{family.lower()}_turnover_commission.png")

        trade_example = test_trades[
            (test_trades["family"] == family)
            & (test_trades["path_id"] == example_id)
            & (test_trades["model_seed"] == example_seed)
        ]
        heat = trade_example.pivot_table(index="instrument", columns="scenario_day", values="net_trade_try", aggfunc="sum", fill_value=0.0)
        fig, ax = plt.subplots(figsize=(13, 6))
        image = ax.imshow(heat.to_numpy(), aspect="auto", cmap="RdBu", interpolation="nearest")
        ax.set_yticks(np.arange(len(heat.index))); ax.set_yticklabels(heat.index, fontsize=7)
        ax.set_title(f"{family} Örnek Yol: Hisse Bazlı Net İşlem Isı Haritası (TL)")
        fig.colorbar(image, ax=ax, shrink=0.75); save(fig, f"test_{family.lower()}_trade_heatmap.png")

    for column, title, name in [
        ("mean_excess_return", "Final Test: Ortalama Excess Return", "final_test_excess.png"),
        ("mean_mdd_improvement", "Final Test: MDD İyileşmesi", "final_test_mdd.png"),
        ("dual_success_rate", "Final Test: Çift Başarı Oranı", "final_test_success.png"),
        ("mean_total_reward", "Final Test: Ortalama Toplam Reward", "final_test_reward.png"),
    ]:
        pivot = test_summary.pivot(index="model_seed", columns="family", values=column)
        fig, ax = plt.subplots(figsize=(9, 5)); pivot.plot(kind="bar", ax=ax)
        ax.axhline(0, color="black", linewidth=0.8); ax.set_title(title); ax.grid(axis="y", alpha=0.25); save(fig, name)

    fig, ax = plt.subplots(figsize=(11, 5))
    for seed, group in checkpoint_scores.groupby("seed"):
        ordered = group[group["timestep"] >= 0].sort_values("timestep")
        ax.plot(ordered["timestep"], ordered["utility"], marker="o", label=f"seed {seed}")
    ax.set_title("Final Checkpoint Validation Utility"); ax.set_xlabel("Step"); ax.legend(); ax.grid(alpha=0.25); save(fig, "final_checkpoint_utility.png")

    fig, ax = plt.subplots(figsize=(11, 5))
    for seed, group in training_episodes.groupby("model_seed"):
        ax.plot(group["episode_index"], group["reward_moving_average_100"], label=f"seed {seed}")
    ax.set_title("Final Eğitim: 100 Episode Moving Average Reward"); ax.legend(); ax.grid(alpha=0.25); save(fig, "final_training_reward_moving_average.png")

    fig, ax = plt.subplots(figsize=(11, 5))
    for seed, group in training_episodes.groupby("model_seed"):
        ax.plot(group["episode_index"], group["return_moving_average_100"], label=f"seed {seed}")
    ax.set_title("Final Eğitim: 100 Episode Moving Average Return"); ax.legend(); ax.grid(alpha=0.25); save(fig, "final_training_return_moving_average.png")

    fig, ax = plt.subplots(figsize=(10, 5))
    for family, group in test_episodes.groupby("family"):
        ax.hist(group["total_reward"], bins=24, alpha=0.55, label=family)
    ax.set_title("Final Test: Episode Toplam Reward Dağılımı"); ax.legend(); ax.grid(alpha=0.2); save(fig, "final_test_episode_reward_distribution.png")

    for family in ["S1", "S2"]:
        group = historical_daily[historical_daily["family"] == family]
        fig, ax = plt.subplots(figsize=(11, 5))
        for seed, seed_group in group.groupby("model_seed"):
            ax.plot(seed_group["date"], seed_group["nav"], label=f"Ajan seed {seed}")
        passive = group[group["model_seed"] == group["model_seed"].iloc[0]]
        ax.plot(passive["date"], passive["passive_nav"], color="black", linewidth=2, label="Pasif")
        ax.set_title(f"Gerçek Tarih {family}: Ajan ve Pasif NAV"); ax.tick_params(axis="x", rotation=45); ax.legend(); ax.grid(alpha=0.25); save(fig, f"historical_{family.lower()}_nav.png")


def _feature_sensitivity(config_path: str, model_path: str, output: Path) -> pd.DataFrame:
    runtime = build_runtime_v22(config_path, write_contracts=False)
    model = PPO.load(model_path, device=runtime.config["ppo"]["device"])
    env = BistStressEnvV22(runtime.config, runtime.scenarios, split="test")
    observations = []
    for path in runtime.scenarios.frozen_paths("test")[:16]:
        observation, _ = env.reset(options={"scenario_path": path})
        done = False
        while not done and len(observations) < 2048:
            observations.append(observation.copy())
            action, _ = model.predict(observation, deterministic=True)
            observation, _, terminated, truncated, _ = env.step(action)
            done = bool(terminated or truncated)
        if len(observations) >= 2048:
            break
    env.close()
    matrix = np.asarray(observations, dtype=np.float32)
    baseline, _ = model.predict(matrix, deterministic=True)
    model_file = Path(model_path)
    contract_path = model_file.parent / "feature_contract.json"
    if not contract_path.exists():
        contract_path = model_file.parent.parent / "feature_contract.json"
    contract = json.loads(contract_path.read_text(encoding="utf-8")) if contract_path.exists() else None
    if contract is None:
        contract = {"feature_order": [f"feature_{index}" for index in range(matrix.shape[1])]}
    rng = np.random.default_rng(271828)
    rows = []
    for index, name in enumerate(contract["feature_order"]):
        perturbed = matrix.copy()
        perturbed[:, index] = perturbed[rng.permutation(len(perturbed)), index]
        actions, _ = model.predict(perturbed, deterministic=True)
        rows.append({"feature_index": index, "feature": name, "mean_abs_action_change": float(np.mean(np.abs(actions - baseline))), "samples": int(len(matrix))})
    frame = pd.DataFrame(rows).sort_values("mean_abs_action_change", ascending=False)
    frame.to_csv(output / "feature_permutation_sensitivity.csv", index=False)
    fig, ax = plt.subplots(figsize=(10, 7))
    top = frame.head(25).sort_values("mean_abs_action_change")
    ax.barh(top["feature"], top["mean_abs_action_change"])
    ax.set_title("PPO Politika Feature Permutation Sensitivity - İlk 25")
    fig.tight_layout(); fig.savefig(output / "plots" / "feature_sensitivity_top25.png", dpi=170); plt.close(fig)
    return frame


def _package(root: Path, output: Path, deployment: dict, test_summary: pd.DataFrame, quality: dict) -> Path:
    bundle = root / "artifacts_v22" / "final_delivery" / "model_bundle"
    bundle.mkdir(parents=True, exist_ok=True)
    model_source = Path(deployment["model_path"])
    run_dir = Path(deployment["run_dir"])
    shutil.copy2(model_source, bundle / "ppo_model.zip")
    for source, destination in [
        (run_dir / "resolved_config.yaml", "resolved_config.yaml"),
        (run_dir / "feature_contract.json", "feature_contract.json"),
        (run_dir / "action_contract.json", "action_contract.json"),
        (run_dir / "reward_contract.json", "reward_contract.json"),
        (root / "artifacts_v22" / "data_contract_v22.json", "data_contract_v22.json"),
        (root / "requirements.txt", "requirements.txt"),
        (root / "TECHNICAL_ARCHITECTURE_V22.md", "TECHNICAL_ARCHITECTURE_V22.md"),
    ]:
        shutil.copy2(source, bundle / destination)
    config = load_config(deployment["config"])
    _write_json(bundle / "instrument_order.json", {"symbols": list(config["universe"]["tickers"]) + [config["universe"]["tpp_symbol"]], "continuous_fractional_weights": True})
    _write_json(bundle / "initial_target.json", config["universe"]["initial_weights"])
    pd.DataFrame(
        [
            {"asset_code": symbol, "weight": config["universe"]["initial_weights"][symbol]}
            for symbol in list(config["universe"]["tickers"])
            + [config["universe"]["tpp_symbol"]]
        ]
    ).to_csv(bundle / "initial_portfolio_example.csv", index=False)
    _write_json(
        bundle / "deployment_manifest.json",
        {
            "schema_version": "bist_stress_rl_v22_deployment",
            "model_id": config["model"]["id"],
            "model_seed": int(deployment["seed"]),
            "checkpoint_kind": deployment["kind"],
            "checkpoint_timestep": int(deployment["timestep"]),
            "state_dimension": int(config["observation"]["dimension"]),
            "action_dimension": int(config["action"]["raw_dimension"]),
            "model_sha256": _sha256(bundle / "ppo_model.zip"),
            "config_sha256": _sha256(bundle / "resolved_config.yaml"),
            "fixed_inference_scenarios": {
                "S1": {"active_start": "2025-03-17", "active_end": "2025-05-05"},
                "S2": {"active_start": "2025-08-26", "active_end": "2025-10-17"},
            },
            "supports_custom_historical_intervals": True,
            "supports_custom_initial_nav_and_weights": True,
            "supports_inline_and_interactive_portfolio_input": True,
            "daily_console_nav_and_weights": True,
            "no_yahoo_finance": True,
        },
    )
    source_bundle = bundle / "src" / "bist_stress_rl"
    shutil.copytree(
        root / "src" / "bist_stress_rl",
        source_bundle,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )
    shutil.copy2(root / "pyproject.toml", bundle / "pyproject.toml")
    run_help = [
        "# Modeli Yükleme ve İki Sabit Senaryoda Inference",
        "",
        "Birincil arayüz iki gerçek tarih aralığını nedensel olarak replay eder ve gün gün NAV, işlem,",
        "kesirli portföy ağırlığı, PPO action, reward ve pasif fon karşılaştırması üretir.",
        "",
        "```powershell",
        "$env:PYTHONPATH = (Resolve-Path '.\\src')",
        "python -m bist_stress_rl.fixed_scenario_inference_v22 --config resolved_config.yaml --model ppo_model.zip --scenario both --data-root <PARQUET_KLASORU> --output-dir <CIKTI_KLASORU>",
        "```",
        "",
        "S1: 17.03.2025-05.05.2025; S2: 26.08.2025-17.10.2025. Warmup 20 getiri seansı/21 kapanıştır.",
        "İzahname hard action decoder ile uygulanır; ağırlıklar kesirlidir. Yahoo Finance kullanılmaz.",
        "İstenen başka bir dönem için --scenario S1 veya S2 ile birlikte --start-date ve --end-date verilir.",
        "Başlangıç para büyüklüğü --initial-nav-try, dağılım ise --initial-portfolio-csv ile değiştirilebilir.",
        "Dosyasız kullanım için --initial-weights 'GARAN=10;...;TPP=5' veya --interactive-portfolio kullanılabilir.",
        "",
        "Tek bir hazır observation için ileri seviye arayüz:",
        "",
        "```powershell",
        "python -m bist_stress_rl.inference_v22 --config resolved_config.yaml --model ppo_model.zip --observation-npy observation.npy --previous-target-json initial_target.json --stress-active --elapsed-sessions 0 --output karar.json",
        "```",
    ]
    (bundle / "README_RUN.md").write_text("\n".join(run_help) + "\n", encoding="utf-8")
    card = [
        "# BIST16 + TPP PPO V2.2 Model Card",
        "",
        f"Model: {config['model']['id']}",
        f"Seed: {int(deployment['seed'])}",
        f"Checkpoint: {deployment['kind']} / step {int(deployment['timestep'])}",
        "Seçim yalnızca frozen validation ile yapılmıştır; test seçimde kullanılmamıştır.",
        "P2 oracle canlı model değildir. Bu paket P1 senaryo-koşullu uygulanabilir ajandır.",
        "İzahname kuralları hard action decoder ile uygulanır. Ağırlıklar kesirlidir.",
        "Girdi state'i 245 boyutludur; senaryo kimliği/şiddeti karar anında haricen sağlanmalıdır.",
        "Model finansal tavsiye değildir; 2025 olay replay'leri kalibrasyon tanısıdır.",
        "",
        f"Test teknik kapıları: {'GEÇTİ' if quality['all_mandatory_gates_pass'] else 'KALDI'}",
    ]
    (bundle / "MODEL_CARD.md").write_text("\n".join(card) + "\n", encoding="utf-8")
    checksums = {
        str(path.relative_to(bundle)).replace("\\", "/"): _sha256(path)
        for path in bundle.rglob("*")
        if path.is_file() and path.name != "checksums.json"
    }
    _write_json(bundle / "checksums.json", checksums)
    return bundle


def _final_quality_gates(test_jobs: list[dict]) -> tuple[dict, pd.DataFrame, pd.DataFrame]:
    """Run the shared numerical gates with the final-test structural contract.

    Pilot validation is represented as six independent jobs, whereas the final
    evaluation is represented as three seed jobs and each job contains both S1
    and S2 (64 frozen paths per family).  The shared gate checker validates all
    numerical invariants correctly, but its two pilot-specific cardinality
    checks must be restated for the final-test layout.
    """
    checks, episodes, daily = _quality_gates(test_jobs)
    cells = (
        episodes.groupby(["model_seed", "family"], as_index=False)
        .agg(paths=("path_id", "nunique"))
        .sort_values(["model_seed", "family"])
    )
    expected_seeds = {42, 31415, 271828}
    expected_families = {"S1", "S2"}
    observed_seeds = {int(value) for value in cells["model_seed"].unique()}
    observed_families = {str(value) for value in cells["family"].unique()}
    checks["three_seed_jobs_present"] = len(test_jobs) == 3
    checks["six_runs_present"] = len(cells) == 6
    checks["expected_final_seeds_present"] = observed_seeds == expected_seeds
    checks["both_stress_families_present"] = observed_families == expected_families
    checks["all_have_64_paths"] = bool(len(cells) == 6 and (cells["paths"] == 64).all())
    checks["all_mandatory_gates_pass"] = bool(
        all(value for key, value in checks.items() if key != "all_mandatory_gates_pass")
    )
    return checks, episodes, daily


def run() -> Path:
    root = Path.cwd().resolve()
    pipeline = root / "artifacts_v22" / "pipeline"
    log_path = pipeline / "execution_log.jsonl"
    training = json.loads((pipeline / "final_training_coordinator.json").read_text(encoding="utf-8"))
    if training.get("status") != "complete" or len(training.get("completed", [])) != 3:
        raise RuntimeError("Three final training seeds are not complete")
    output = root / "artifacts_v22" / "final_delivery"
    output.mkdir(parents=True, exist_ok=True)
    coordinator_path = pipeline / "postfinal_coordinator.json"
    coordinator = {"schema_version": "bist_stress_rl_v22_postfinal", "status": "running", "started_at": _now(), "current_stage": "checkpoint_validation"}
    _write_json(coordinator_path, coordinator)
    try:
        checkpoint_scores, selected_by_seed, deployment = _select_checkpoints(training["completed"], pipeline, coordinator, coordinator_path, log_path)
        selected_by_seed, deployment, extension = _extend_if_below_gate(
            root,
            pipeline,
            selected_by_seed,
            deployment,
            coordinator,
            coordinator_path,
            log_path,
        )
        pretest = json.loads((pipeline / "final_checkpoint_selection_pretest.json").read_text(encoding="utf-8"))
        pretest.update(
            {
                "selected_by_seed": selected_by_seed,
                "deployment_checkpoint": deployment,
                "controlled_extension": extension,
                "selection_frozen_before_test_at": _now(),
            }
        )
        _write_json(pipeline / "final_checkpoint_selection_pretest.json", pretest)
        test_jobs, historical_jobs = _final_evaluations(selected_by_seed, coordinator, coordinator_path, log_path)
        quality, test_episodes, test_daily = _final_quality_gates(test_jobs)
        test_summary = _summary(test_episodes)
        test_trades = _aggregate_jobs(test_jobs, "trade_blotter.parquet")
        historical_episodes = _aggregate_jobs(historical_jobs, "episode_summary.parquet")
        historical_daily = _aggregate_jobs(historical_jobs, "daily_portfolio.parquet")
        historical_trades = _aggregate_jobs(historical_jobs, "trade_blotter.parquet")
        training_progress, training_episodes = _training_curves(training["completed"])
        test_episodes.to_parquet(output / "final_test_all_episodes.parquet", index=False)
        test_episodes.to_csv(output / "final_test_all_episodes.csv", index=False)
        test_daily.to_parquet(output / "final_test_all_daily.parquet", index=False)
        test_daily.to_csv(output / "final_test_all_daily.csv.gz", index=False, compression="gzip")
        test_summary.to_csv(output / "final_test_summary_by_seed_family.csv", index=False)
        test_trades.to_parquet(output / "final_test_trade_blotter.parquet", index=False)
        test_trades.to_csv(output / "final_test_trade_blotter.csv.gz", index=False, compression="gzip")
        historical_episodes.to_csv(output / "final_historical_episodes.csv", index=False)
        historical_daily.to_parquet(output / "final_historical_daily.parquet", index=False)
        historical_daily.to_csv(output / "final_historical_daily.csv", index=False)
        historical_trades.to_parquet(output / "final_historical_trade_blotter.parquet", index=False)
        historical_trades.to_csv(output / "final_historical_trade_blotter.csv", index=False)
        training_progress.to_csv(output / "final_training_progress.csv", index=False)
        training_episodes.to_csv(output / "final_training_episode_log.csv.gz", index=False, compression="gzip")
        checkpoint_scores.to_csv(output / "final_checkpoint_validation_scores.csv", index=False)
        _write_json(output / "final_test_quality_gates.json", quality)
        _write_json(output / "deployment_selection.json", {"deployment": deployment, "selected_by_seed": selected_by_seed, "test_not_used_for_selection": True})
        reward_components = ["reward_relative", "reward_mdd_absolute", "reward_mdd_relative", "reward_target_change"]
        reward_rows = []
        for (seed, family), group in test_daily.groupby(["model_seed", "family"]):
            for component in reward_components:
                values = group[component].to_numpy(dtype=float)
                reward_rows.append({"model_seed": int(seed), "family": family, "component": component, "sum": float(values.sum()), "mean": float(values.mean()), "positive_days": int(np.count_nonzero(values > 1e-12)), "negative_days": int(np.count_nonzero(values < -1e-12)), "zero_days": int(np.count_nonzero(np.abs(values) <= 1e-12))})
        pd.DataFrame(reward_rows).to_csv(output / "final_reward_component_counts.csv", index=False)
        _plots(output, test_episodes, test_daily, test_trades, historical_daily, test_summary, checkpoint_scores, training_episodes)
        coordinator["current_stage"] = "feature_sensitivity"
        _write_json(coordinator_path, coordinator)
        sensitivity = _feature_sensitivity(deployment["config"], deployment["model_path"], output)
        bundle = _package(root, output, deployment, test_summary, quality)
        overall = _episode_metrics(test_episodes)
        report = [
            "# BIST16 + TPP PPO V2.2 Final Teknik Teslimat",
            "",
            f"Üretim: {_now()}",
            f"Canlı aday: P1_SCENARIO_CONDITIONED, seed {int(deployment['seed'])}, {deployment['kind']}, step {int(deployment['timestep'])}",
            "Model/checkpoint seçimi yalnızca frozen validation sonuçlarıyla yapılmış, test daha sonra açılmıştır.",
            "",
            "## Final test özeti",
            f"Toplam episode: {len(overall)} (3 seed x 64 S1 + 64 S2)",
            f"Ortalama excess return: {overall['excess_terminal_return'].mean():.6f}",
            f"Ortalama MDD iyileşmesi: {overall['mdd_improvement'].mean():.6f}",
            f"Return başarı oranı: {overall['return_success'].mean():.2%}",
            f"MDD başarı oranı: {overall['mdd_success'].mean():.2%}",
            f"Çift başarı oranı: {overall['dual_success'].mean():.2%}",
            f"İzahname dışı gün: {int(overall['illegal_days'].sum())}",
            "",
            "## Teknik mimari",
            "State: 245; action: Box(-1,1,18); PPO rollout: 8x192=1536; minibatch 256; epoch 4; actor/critic [192,96] Tanh.",
            "Reward: 100x pasife göre net log getiri - 6x incremental drawdown - 4x pozitif MDD fark artışı - 8x hedef değişimi.",
            "İzahname reward ile değil hard decoder ile garanti edilir. Alım ve satım komisyonu ayrı ayrı yüzde 0.05'tir.",
            "Bir step bir işlem günü, bir episode bir sentetik stres yoludur. PPO replay buffer, target network ve epsilon-greedy kullanmaz.",
            "",
            "## Metodolojik sınırlar",
            "Gerçek S1/S2 dönemleri sentetik üreticiyi kalibre ettiği için tarihsel replay bağımsız test değildir. P1 senaryo bilgisinin karar anında haricen sağlandığını varsayar. P2 oracle canlıya alınmamıştır.",
            "",
            "## Teslimatlar",
            f"Model paketi: {bundle}",
            f"Grafik sayısı: {len(list((output / 'plots').glob('*.png')))}",
            f"Feature sensitivity satırı: {len(sensitivity)}",
        ]
        (output / "FINAL_TEKNIK_TESLIMAT.md").write_text("\n".join(report) + "\n", encoding="utf-8")
        coordinator.update({"status": "complete", "finished_at": _now(), "current_stage": None, "delivery_dir": str(output.resolve()), "bundle_dir": str(bundle.resolve())})
        _write_json(coordinator_path, coordinator)
        from .completion_audit_v22 import audit as completion_audit

        audit_result = completion_audit(root)
        if not audit_result["all_requirements_pass"]:
            raise RuntimeError(
                f"Completion audit failed: {audit_result['passed']}/{audit_result['total']}"
            )
        _log(log_path, "postfinal_complete", delivery_dir=str(output.resolve()), deployment_seed=int(deployment["seed"]))
        return output
    except BaseException as exc:
        coordinator.update({"status": "failed", "finished_at": _now(), "error": repr(exc)})
        _write_json(coordinator_path, coordinator)
        _log(log_path, "postfinal_failed", error=repr(exc))
        raise


def main() -> None:
    argparse.ArgumentParser().parse_args()
    output = run()
    print(f"V22_POSTFINAL_COMPLETE {output}", flush=True)


if __name__ == "__main__":
    main()
