from __future__ import annotations

import argparse
import csv
import json
import platform
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable

import numpy as np
import torch
import yaml
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback, CallbackList, CheckpointCallback, EvalCallback
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv, VecEnv

from .env_v22 import BistStressEnvV22
from .runtime_v22 import RuntimeV22, build_runtime_v22
from .scenarios_v22 import ScenarioPathV22
from .state_v22 import StateBuilderV22


def linear_schedule(start: float, end: float) -> Callable[[float], float]:
    def schedule(progress_remaining: float) -> float:
        return float(end + (start - end) * progress_remaining)

    return schedule


@dataclass
class EnvFactoryV22:
    runtime: RuntimeV22
    split: str
    seed: int
    fixed_paths: list[ScenarioPathV22] | None = None

    def __call__(self):
        env = BistStressEnvV22(
            self.runtime.config,
            self.runtime.scenarios,
            split=self.split,
            fixed_paths=self.fixed_paths,
        )
        env.reset(seed=self.seed)
        return Monitor(env)


class EvidenceCallbackV22(BaseCallback):
    def __init__(self, output_dir: Path, total_timesteps: int, increments: int):
        super().__init__(verbose=0)
        self.output_dir = Path(output_dir)
        self.total_timesteps = int(total_timesteps)
        self.increment = max(1, self.total_timesteps // int(increments))
        self.next_report = self.increment
        self.started = 0.0
        self.handles: list = []

    def _on_training_start(self) -> None:
        self.started = time.perf_counter()
        episode_handle = (self.output_dir / "episode_summary.csv").open(
            "w", newline="", encoding="utf-8"
        )
        progress_handle = (self.output_dir / "progress.csv").open(
            "w", newline="", encoding="utf-8"
        )
        diagnostic_handle = (self.output_dir / "train_diagnostics.csv").open(
            "w", newline="", encoding="utf-8"
        )
        self.handles = [episode_handle, progress_handle, diagnostic_handle]
        self.episode_writer = csv.DictWriter(
            episode_handle,
            fieldnames=[
                "timesteps",
                "model_id",
                "family",
                "scenario_track",
                "scenario_seed",
                "episode_days",
                "total_reward",
                "final_nav",
                "passive_final_nav",
                "final_return",
                "passive_final_return",
                "excess_return",
                "running_max_drawdown",
                "passive_max_drawdown",
                "mdd_improvement",
                "target_turnover",
                "realized_turnover",
                "total_commission",
                "trade_days",
                "target_update_days",
                "budget_saturation_days",
                "heavy_switches",
                "geometry_clip_days",
                "no_change_days",
                "positive_reward_days",
                "negative_reward_days",
                "mdd_penalty_days",
                "mdd_gap_penalty_days",
                "target_penalty_days",
                "min_tpp",
                "max_tpp",
            ],
        )
        self.episode_writer.writeheader()
        self.progress_writer = csv.DictWriter(
            progress_handle,
            fieldnames=["timestamp", "timesteps", "percent", "steps_per_second", "eta_seconds"],
        )
        self.progress_writer.writeheader()
        self.diagnostic_writer = csv.DictWriter(
            diagnostic_handle,
            fieldnames=[
                "timesteps",
                "approx_kl",
                "clip_fraction",
                "entropy_loss",
                "explained_variance",
                "policy_gradient_loss",
                "value_loss",
                "loss",
                "learning_rate",
            ],
        )
        self.diagnostic_writer.writeheader()

    def _on_step(self) -> bool:
        for done, info in zip(self.locals.get("dones", []), self.locals.get("infos", [])):
            if not done or "final_return" not in info:
                continue
            episode = info.get("episode", {})
            self.episode_writer.writerow(
                {
                    "timesteps": self.num_timesteps,
                    "model_id": info.get("model_id", ""),
                    "family": info.get("family", ""),
                    "scenario_track": info.get("scenario_track", ""),
                    "scenario_seed": info.get("scenario_seed", ""),
                    "episode_days": int(episode.get("l", 0)),
                    "total_reward": float(info["episode_total_reward"]),
                    "final_nav": float(info["nav"]),
                    "passive_final_nav": float(info["passive_nav"]),
                    "final_return": float(info["final_return"]),
                    "passive_final_return": float(info["passive_final_return"]),
                    "excess_return": float(info["excess_return"]),
                    "running_max_drawdown": float(info["running_max_drawdown"]),
                    "passive_max_drawdown": float(info["passive_max_drawdown"]),
                    "mdd_improvement": float(
                        info["passive_max_drawdown"] - info["running_max_drawdown"]
                    ),
                    "target_turnover": float(info["episode_total_target_turnover"]),
                    "realized_turnover": float(info["episode_total_turnover"]),
                    "total_commission": float(info["episode_total_commission"]),
                    "trade_days": int(info["trade_days"]),
                    "target_update_days": int(info["target_update_days"]),
                    "budget_saturation_days": int(info["episode_budget_saturation_days"]),
                    "heavy_switches": int(info["episode_heavy_switches"]),
                    "geometry_clip_days": int(info["episode_geometry_clip_days"]),
                    "no_change_days": int(info["episode_no_change_days"]),
                    "positive_reward_days": int(info["episode_positive_reward_days"]),
                    "negative_reward_days": int(info["episode_negative_reward_days"]),
                    "mdd_penalty_days": int(info["episode_mdd_penalty_days"]),
                    "mdd_gap_penalty_days": int(info["episode_mdd_gap_penalty_days"]),
                    "target_penalty_days": int(info["episode_target_penalty_days"]),
                    "min_tpp": float(info["episode_min_tpp"]),
                    "max_tpp": float(info["episode_max_tpp"]),
                }
            )
            self.handles[0].flush()
        if self.num_timesteps >= self.next_report or self.num_timesteps >= self.total_timesteps:
            elapsed = max(time.perf_counter() - self.started, 1e-9)
            rate = self.num_timesteps / elapsed
            remaining = max(0, self.total_timesteps - self.num_timesteps)
            row = {
                "timestamp": datetime.now().isoformat(timespec="seconds"),
                "timesteps": self.num_timesteps,
                "percent": round(min(100.0, 100.0 * self.num_timesteps / self.total_timesteps), 2),
                "steps_per_second": round(rate, 2),
                "eta_seconds": round(remaining / max(rate, 1e-9), 1),
            }
            self.progress_writer.writerow(row)
            self.handles[1].flush()
            print(
                f"V22_TRAINING_PROGRESS model={self.model_id} {row['percent']:.2f}% "
                f"({self.num_timesteps}/{self.total_timesteps}) {rate:.1f} steps/s",
                flush=True,
            )
            while self.next_report <= self.num_timesteps:
                self.next_report += self.increment
        return True

    @property
    def model_id(self) -> str:
        return self.output_dir.parent.parent.name

    def _on_rollout_end(self) -> None:
        values = self.logger.name_to_value
        mapping = {
            "approx_kl": "train/approx_kl",
            "clip_fraction": "train/clip_fraction",
            "entropy_loss": "train/entropy_loss",
            "explained_variance": "train/explained_variance",
            "policy_gradient_loss": "train/policy_gradient_loss",
            "value_loss": "train/value_loss",
            "loss": "train/loss",
            "learning_rate": "train/learning_rate",
        }
        row = {"timesteps": self.num_timesteps}
        for output, source in mapping.items():
            value = values.get(source, np.nan)
            row[output] = float(value) if value is not None else np.nan
        self.diagnostic_writer.writerow(row)
        self.handles[2].flush()

    def _on_training_end(self) -> None:
        for handle in self.handles:
            handle.close()


def make_training_env_v22(runtime: RuntimeV22, seed: int, vec_env: str | None = None) -> VecEnv:
    cfg = runtime.config["ppo"]
    factories = [
        EnvFactoryV22(runtime, "train", seed + rank * 1009)
        for rank in range(int(cfg["n_envs"]))
    ]
    selected = vec_env or str(cfg["vec_env"])
    if selected == "SubprocVecEnv" and len(factories) > 1:
        return SubprocVecEnv(factories, start_method=str(cfg["subproc_start_method"]))
    return DummyVecEnv(factories)


def make_validation_env_v22(runtime: RuntimeV22, seed: int) -> DummyVecEnv:
    paths = runtime.scenarios.frozen_paths("validation")
    return DummyVecEnv([EnvFactoryV22(runtime, "validation", seed + 100_000, paths)])


def train_v22(
    config_path: str,
    timesteps: int,
    *,
    seed: int,
    run_name: str | None = None,
    resume: str | None = None,
    vec_env: str | None = None,
) -> Path:
    runtime = build_runtime_v22(config_path)
    cfg = runtime.config
    model_id = str(cfg["model"]["id"])
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(int(cfg["ppo"]["torch_num_threads"]))
    try:
        torch.set_num_interop_threads(int(cfg["ppo"]["torch_num_interop_threads"]))
    except RuntimeError:
        pass
    suffix = run_name or f"{model_id.lower()}_seed{seed}_{datetime.now():%Y%m%d_%H%M%S}"
    output_dir = Path(cfg["paths"]["run_root"]) / suffix
    output_dir.mkdir(parents=True, exist_ok=False)
    for child in ["checkpoints", "best_model", "eval_logs"]:
        (output_dir / child).mkdir()
    serializable = {key: value for key, value in cfg.items() if not key.startswith("_")}
    (output_dir / "resolved_config.yaml").write_text(
        yaml.safe_dump(serializable, sort_keys=False, allow_unicode=True), encoding="utf-8"
    )
    state_contract = StateBuilderV22(cfg).contract()
    (output_dir / "feature_contract.json").write_text(
        json.dumps(state_contract, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (output_dir / "action_contract.json").write_text(
        json.dumps(
            {
                "version": cfg["action"]["version"],
                "dimension": cfg["action"]["raw_dimension"],
                "layout": cfg["action"]["layout"],
                "bounds": [-1.0, 1.0],
                "continuous_fractional_weights": True,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (output_dir / "reward_contract.json").write_text(
        json.dumps(cfg["reward"], indent=2, ensure_ascii=False), encoding="utf-8"
    )

    selected_vec = vec_env or str(cfg["ppo"]["vec_env"])
    manifest = {
        "schema_version": f"bist_stress_rl_v{cfg['config_version']}",
        "model_id": model_id,
        "model_role": cfg["model"]["role"],
        "deployable": bool(cfg["model"]["deployable"]),
        "run_name": suffix,
        "model_seed": int(seed),
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "timesteps_requested": int(timesteps),
        "resume": resume,
        "python": platform.python_version(),
        "platform": platform.platform(),
        "torch": torch.__version__,
        "stable_baselines3": __import__("stable_baselines3").__version__,
        "device": cfg["ppo"]["device"],
        "vec_env": selected_vec,
        "n_envs": int(cfg["ppo"]["n_envs"]),
        "state_dimension": int(cfg["observation"]["dimension"]),
        "raw_action_dimension": int(cfg["action"]["raw_dimension"]),
        "rollout_buffer_transitions": int(cfg["ppo"]["n_envs"]) * int(cfg["ppo"]["n_steps"]),
        "replay_buffer": False,
        "target_network": False,
        "epsilon_greedy": False,
    }
    (output_dir / "run_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    env = make_training_env_v22(runtime, seed, selected_vec)
    eval_env = make_validation_env_v22(runtime, seed)
    policy_kwargs = {
        "net_arch": {
            "pi": list(cfg["ppo"]["actor_layers"]),
            "vf": list(cfg["ppo"]["critic_layers"]),
        },
        "activation_fn": torch.nn.Tanh,
        "log_std_init": float(cfg["ppo"]["log_std_init"]),
        "ortho_init": True,
    }
    if resume:
        model = PPO.load(resume, env=env, device=cfg["ppo"]["device"])
    else:
        model = PPO(
            "MlpPolicy",
            env,
            device=cfg["ppo"]["device"],
            seed=seed,
            n_steps=int(cfg["ppo"]["n_steps"]),
            batch_size=int(cfg["ppo"]["batch_size"]),
            n_epochs=int(cfg["ppo"]["n_epochs"]),
            learning_rate=linear_schedule(
                float(cfg["ppo"]["learning_rate_start"]),
                float(cfg["ppo"]["learning_rate_end"]),
            ),
            gamma=float(cfg["ppo"]["gamma"]),
            gae_lambda=float(cfg["ppo"]["gae_lambda"]),
            clip_range=linear_schedule(
                float(cfg["ppo"]["clip_range_start"]),
                float(cfg["ppo"]["clip_range_end"]),
            ),
            ent_coef=float(cfg["ppo"]["ent_coef"]),
            vf_coef=float(cfg["ppo"]["vf_coef"]),
            max_grad_norm=float(cfg["ppo"]["max_grad_norm"]),
            target_kl=float(cfg["ppo"]["target_kl"]),
            normalize_advantage=True,
            policy_kwargs=policy_kwargs,
            verbose=1,
        )
    manifest["trainable_parameters"] = int(
        sum(parameter.numel() for parameter in model.policy.parameters())
    )
    (output_dir / "run_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    n_envs = int(cfg["ppo"]["n_envs"])
    callbacks = CallbackList(
        [
            CheckpointCallback(
                save_freq=max(1, int(cfg["experiments"]["checkpoint_every_timesteps"]) // n_envs),
                save_path=str(output_dir / "checkpoints"),
                name_prefix=f"{model_id.lower()}_seed{seed}",
            ),
            EvalCallback(
                eval_env,
                best_model_save_path=str(output_dir / "best_model"),
                log_path=str(output_dir / "eval_logs"),
                eval_freq=max(1, int(cfg["experiments"]["validation_every_timesteps"]) // n_envs),
                n_eval_episodes=int(cfg["experiments"]["validation_episodes"]),
                deterministic=True,
                render=False,
                warn=False,
            ),
            EvidenceCallbackV22(
                output_dir,
                timesteps,
                int(cfg["logging"]["progress_increments"]),
            ),
        ]
    )
    succeeded = False
    try:
        model.learn(
            total_timesteps=int(timesteps),
            callback=callbacks,
            reset_num_timesteps=resume is None,
            progress_bar=False,
        )
        model.save(output_dir / f"{model_id.lower()}_final_model")
        succeeded = True
    finally:
        env.close()
        eval_env.close()
    manifest["finished_at"] = datetime.now().isoformat(timespec="seconds")
    manifest["status"] = "complete" if succeeded else "failed"
    manifest["model_path"] = str(
        (output_dir / f"{model_id.lower()}_final_model.zip").resolve()
    )
    (output_dir / "run_manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"V22_TRAINING_COMPLETE model={model_id} path={manifest['model_path']}", flush=True)
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--timesteps", type=int)
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--pilot", action="store_true")
    parser.add_argument("--run-name")
    parser.add_argument("--resume")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--vec-env", choices=["DummyVecEnv", "SubprocVecEnv"])
    args = parser.parse_args()
    from .config import load_config

    config = load_config(args.config)
    if args.smoke:
        default_steps = int(config["experiments"]["smoke_timesteps"])
    elif args.pilot:
        default_steps = int(config["experiments"]["pilot_timesteps"])
    else:
        default_steps = int(config["experiments"]["final_timesteps_per_seed"])
    seed = int(args.seed if args.seed is not None else config["project"]["random_seed"])
    train_v22(
        args.config,
        int(args.timesteps or default_steps),
        seed=seed,
        run_name=args.run_name,
        resume=args.resume,
        vec_env=args.vec_env,
    )


if __name__ == "__main__":
    main()
