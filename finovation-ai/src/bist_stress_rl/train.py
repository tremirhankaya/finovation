from __future__ import annotations

import argparse
import csv
import json
import platform
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import numpy as np
import torch
import yaml
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback, CallbackList, CheckpointCallback, EvalCallback
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv, VecEnv

from .env import BistStressEnv
from .runtime import Runtime, build_runtime
from .scenarios import ScenarioPath


def linear_schedule(start: float, end: float) -> Callable[[float], float]:
    def schedule(progress_remaining: float) -> float:
        return float(end + (start - end) * progress_remaining)
    return schedule


@dataclass
class EnvFactory:
    runtime: Runtime
    split: str
    seed: int
    fixed_paths: list[ScenarioPath] | None = None

    def __call__(self):
        env = BistStressEnv(
            self.runtime.config,
            self.runtime.scenarios,
            split=self.split,
            fixed_paths=self.fixed_paths,
        )
        env.reset(seed=self.seed)
        return Monitor(env)


class EvidenceCallback(BaseCallback):
    def __init__(self, output_dir: Path, total_timesteps: int, increments: int = 100):
        super().__init__(verbose=0)
        self.output_dir = output_dir
        self.total_timesteps = int(total_timesteps)
        self.increment = max(1, self.total_timesteps // int(increments))
        self.next_report = self.increment
        self.started = 0.0
        self.episode_handle = None
        self.progress_handle = None
        self.diagnostic_handle = None
        self.episode_writer = None
        self.progress_writer = None
        self.diagnostic_writer = None

    def _on_training_start(self) -> None:
        self.started = time.perf_counter()
        self.episode_handle = (self.output_dir / "episode_summary.csv").open("w", newline="", encoding="utf-8")
        episode_fields = [
            "timesteps", "family", "scenario_seed", "episode_days", "total_reward", "final_nav",
            "final_return", "passive_final_return", "excess_return", "running_max_drawdown",
            "passive_max_drawdown", "mdd_improvement", "total_turnover", "total_commission", "trade_days",
        ]
        self.episode_writer = csv.DictWriter(self.episode_handle, fieldnames=episode_fields)
        self.episode_writer.writeheader()
        self.progress_handle = (self.output_dir / "progress.csv").open("w", newline="", encoding="utf-8")
        self.progress_writer = csv.DictWriter(
            self.progress_handle,
            fieldnames=["timestamp", "timesteps", "percent", "steps_per_second", "eta_seconds"],
        )
        self.progress_writer.writeheader()
        self.diagnostic_handle = (self.output_dir / "train_diagnostics.csv").open("w", newline="", encoding="utf-8")
        self.diagnostic_writer = csv.DictWriter(
            self.diagnostic_handle,
            fieldnames=[
                "timesteps", "approx_kl", "clip_fraction", "entropy_loss", "explained_variance",
                "policy_gradient_loss", "value_loss", "loss", "learning_rate",
            ],
        )
        self.diagnostic_writer.writeheader()

    def _on_step(self) -> bool:
        for done, info in zip(self.locals.get("dones", []), self.locals.get("infos", [])):
            if not done or "final_return" not in info:
                continue
            episode = info.get("episode", {})
            final_return = float(info["final_return"])
            passive_return = float(info["passive_final_return"])
            agent_mdd = float(info["running_max_drawdown"])
            passive_mdd = float(info["passive_max_drawdown"])
            self.episode_writer.writerow(
                {
                    "timesteps": self.num_timesteps,
                    "family": info.get("family", ""),
                    "scenario_seed": info.get("scenario_seed", ""),
                    "episode_days": int(episode.get("l", 0)),
                    "total_reward": float(info.get("total_reward", episode.get("r", np.nan))),
                    "final_nav": float(info["nav"]),
                    "final_return": final_return,
                    "passive_final_return": passive_return,
                    "excess_return": final_return - passive_return,
                    "running_max_drawdown": agent_mdd,
                    "passive_max_drawdown": passive_mdd,
                    "mdd_improvement": passive_mdd - agent_mdd,
                    "total_turnover": float(info["episode_total_turnover"]),
                    "total_commission": float(info["episode_total_commission"]),
                    "trade_days": int(info["trade_days"]),
                }
            )
            self.episode_handle.flush()
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
            self.progress_handle.flush()
            print(
                f"TRAINING_PROGRESS {row['percent']:.2f}% "
                f"({self.num_timesteps}/{self.total_timesteps}) {rate:.1f} steps/s",
                flush=True,
            )
            while self.next_report <= self.num_timesteps:
                self.next_report += self.increment
        return True

    def _on_rollout_end(self) -> None:
        values = self.logger.name_to_value
        row = {"timesteps": self.num_timesteps}
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
        for output, source in mapping.items():
            value = values.get(source, np.nan)
            row[output] = float(value) if value is not None else np.nan
        self.diagnostic_writer.writerow(row)
        self.diagnostic_handle.flush()

    def _on_training_end(self) -> None:
        for handle in (self.episode_handle, self.progress_handle, self.diagnostic_handle):
            if handle is not None:
                handle.close()


def make_training_env(runtime: Runtime, seed: int, vec_env: str | None = None) -> VecEnv:
    cfg = runtime.config["ppo"]
    n_envs = int(cfg["n_envs"])
    factories = [EnvFactory(runtime, "train", seed + rank * 1009) for rank in range(n_envs)]
    selected = vec_env or str(cfg["vec_env"])
    if selected == "SubprocVecEnv" and n_envs > 1:
        return SubprocVecEnv(factories, start_method=str(cfg["subproc_start_method"]))
    return DummyVecEnv(factories)


def make_validation_env(runtime: Runtime, seed: int) -> DummyVecEnv:
    frozen = runtime.scenarios.frozen_paths("validation")
    return DummyVecEnv([EnvFactory(runtime, "validation", seed + 100_000, frozen)])


def train(
    config_path: str,
    timesteps: int,
    *,
    seed: int,
    run_name: str | None = None,
    resume: str | None = None,
    vec_env: str | None = None,
) -> Path:
    runtime = build_runtime(config_path)
    cfg = runtime.config
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(int(cfg["ppo"]["torch_num_threads"]))
    try:
        torch.set_num_interop_threads(int(cfg["ppo"]["torch_num_interop_threads"]))
    except RuntimeError:
        pass

    suffix = run_name or f"ppo_v2_seed{seed}_{datetime.now():%Y%m%d_%H%M%S}"
    output_dir = Path(cfg["paths"]["run_root"]) / suffix
    output_dir.mkdir(parents=True, exist_ok=False)
    for child in ("checkpoints", "best_model", "eval_logs"):
        (output_dir / child).mkdir()
    with (output_dir / "resolved_config.yaml").open("w", encoding="utf-8") as handle:
        serializable = {key: value for key, value in cfg.items() if not key.startswith("_")}
        yaml.safe_dump(serializable, handle, sort_keys=False, allow_unicode=True)

    selected_vec = vec_env or str(cfg["ppo"]["vec_env"])
    metadata: dict[str, Any] = {
        "schema_version": "bist_stress_rl_v2.1",
        "run_name": suffix,
        "model_seed": seed,
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
    }
    (output_dir / "run_manifest.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    env = make_training_env(runtime, seed, selected_vec)
    eval_env = make_validation_env(runtime, seed)
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
                float(cfg["ppo"]["learning_rate_start"]), float(cfg["ppo"]["learning_rate_end"])
            ),
            gamma=float(cfg["ppo"]["gamma"]),
            gae_lambda=float(cfg["ppo"]["gae_lambda"]),
            clip_range=linear_schedule(
                float(cfg["ppo"]["clip_range_start"]), float(cfg["ppo"]["clip_range_end"])
            ),
            ent_coef=float(cfg["ppo"]["ent_coef"]),
            vf_coef=float(cfg["ppo"]["vf_coef"]),
            max_grad_norm=float(cfg["ppo"]["max_grad_norm"]),
            target_kl=float(cfg["ppo"]["target_kl"]),
            normalize_advantage=True,
            policy_kwargs=policy_kwargs,
            verbose=1,
        )
    metadata["trainable_parameters"] = int(sum(parameter.numel() for parameter in model.policy.parameters()))
    (output_dir / "run_manifest.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    n_envs = int(cfg["ppo"]["n_envs"])
    checkpoint = CheckpointCallback(
        save_freq=max(1, int(cfg["experiments"]["checkpoint_every_timesteps"]) // n_envs),
        save_path=str(output_dir / "checkpoints"),
        name_prefix=f"ppo_v2_seed{seed}",
    )
    evaluation = EvalCallback(
        eval_env,
        best_model_save_path=str(output_dir / "best_model"),
        log_path=str(output_dir / "eval_logs"),
        eval_freq=max(1, int(cfg["experiments"]["validation_every_timesteps"]) // n_envs),
        n_eval_episodes=int(cfg["experiments"]["validation_episodes"]),
        deterministic=True,
        render=False,
        warn=False,
    )
    evidence = EvidenceCallback(
        output_dir,
        timesteps,
        increments=int(cfg["logging"]["progress_increments"]),
    )
    succeeded = False
    try:
        model.learn(
            total_timesteps=int(timesteps),
            callback=CallbackList([checkpoint, evaluation, evidence]),
            reset_num_timesteps=resume is None,
            progress_bar=False,
        )
        model.save(output_dir / "final_model")
        succeeded = True
    finally:
        env.close()
        eval_env.close()
    metadata["finished_at"] = datetime.now().isoformat(timespec="seconds")
    metadata["status"] = "complete" if succeeded else "failed"
    metadata["model_path"] = str((output_dir / "final_model.zip").resolve())
    (output_dir / "run_manifest.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    latest = Path(cfg["paths"]["artifacts_dir"]) / "latest_run.txt"
    latest.parent.mkdir(parents=True, exist_ok=True)
    latest.write_text(str(output_dir.resolve()), encoding="utf-8")
    print(f"TRAINING_COMPLETE {output_dir / 'final_model.zip'}", flush=True)
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--timesteps", type=int)
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--pilot", action="store_true")
    parser.add_argument("--run-name")
    parser.add_argument("--resume")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--vec-env", choices=["DummyVecEnv", "SubprocVecEnv"])
    args = parser.parse_args()
    config = __import__("bist_stress_rl.config", fromlist=["load_config"]).load_config(args.config)
    if args.smoke:
        default_steps = int(config["experiments"]["smoke_timesteps"])
    elif args.pilot:
        default_steps = int(config["experiments"]["pilot_timesteps"])
    else:
        default_steps = int(config["experiments"]["final_timesteps_per_seed"])
    seed = int(args.seed if args.seed is not None else config["project"]["random_seed"])
    train(
        args.config,
        int(args.timesteps or default_steps),
        seed=seed,
        run_name=args.run_name,
        resume=args.resume,
        vec_env=args.vec_env,
    )


if __name__ == "__main__":
    main()
