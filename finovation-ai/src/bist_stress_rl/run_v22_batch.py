from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from .config import load_config


MODEL_CONFIGS = [
    "configs_v22/model_p0_scenario_blind.yaml",
    "configs_v22/model_p1_scenario_conditioned.yaml",
    "configs_v22/model_p2_event_oracle.yaml",
]


def _write(path: Path, payload: dict) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def run_batch(phase: str) -> None:
    root = Path.cwd().resolve()
    artifact_root = root / "artifacts_v22"
    log_root = artifact_root / "batch_logs"
    log_root.mkdir(parents=True, exist_ok=True)
    coordinator_path = artifact_root / "training_coordinator.json"
    model_specs = []
    for config_path in MODEL_CONFIGS:
        config = load_config(config_path)
        model_specs.append((config_path, config, str(config["model"]["id"])))

    # Önce üç mimarinin de kısa smoke doğrulamasını bitir. Böylece pahalı pilot
    # eğitimleri, tüm model dosyalarının uçtan uca çalıştığı görülmeden başlamaz.
    jobs = []
    if phase in {"smoke", "all"}:
        for config_path, config, model_id in model_specs:
            jobs.append(
                {
                    "phase": "smoke",
                    "model_id": model_id,
                    "config": config_path,
                    "seed": 42,
                    "timesteps": int(config["experiments"]["smoke_timesteps"]),
                }
            )
    if phase in {"pilot", "all"}:
        for config_path, config, model_id in model_specs:
            for seed in config["experiments"]["pilot_seeds"]:
                jobs.append(
                    {
                        "phase": "pilot",
                        "model_id": model_id,
                        "config": config_path,
                        "seed": int(seed),
                        "timesteps": int(config["experiments"]["pilot_timesteps"]),
                    }
                )
    payload = {
        "schema_version": "bist_stress_rl_v22_batch",
        "status": "running",
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "phase_requested": phase,
        "jobs_total": len(jobs),
        "jobs_completed": 0,
        "current_job": None,
        "jobs": jobs,
        "completed_runs": [],
    }
    _write(coordinator_path, payload)
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(root / "src")
    try:
        for index, job in enumerate(jobs, start=1):
            suffix = f"{job['phase']}_{job['model_id'].lower()}_seed{job['seed']}_{datetime.now():%Y%m%d_%H%M%S}"
            log_path = log_root / f"{suffix}.log"
            job.update(
                {
                    "index": index,
                    "run_name": suffix,
                    "log_path": str(log_path.resolve()),
                    "started_at": datetime.now().isoformat(timespec="seconds"),
                    "status": "running",
                }
            )
            payload["current_job"] = job
            _write(coordinator_path, payload)
            command = [
                sys.executable,
                "-m",
                "bist_stress_rl.train_v22",
                "--config",
                job["config"],
                "--timesteps",
                str(job["timesteps"]),
                "--seed",
                str(job["seed"]),
                "--vec-env",
                "SubprocVecEnv",
                "--run-name",
                suffix,
            ]
            with log_path.open("w", encoding="utf-8") as log:
                result = subprocess.run(
                    command,
                    cwd=root,
                    env=environment,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    text=True,
                    check=False,
                )
            job["finished_at"] = datetime.now().isoformat(timespec="seconds")
            job["exit_code"] = int(result.returncode)
            job["status"] = "complete" if result.returncode == 0 else "failed"
            payload["completed_runs"].append(dict(job))
            payload["jobs_completed"] = len(payload["completed_runs"])
            payload["current_job"] = None
            if result.returncode != 0:
                payload["status"] = "failed"
                payload["error"] = f"{job['model_id']} {job['phase']} exited with {result.returncode}"
                _write(coordinator_path, payload)
                raise SystemExit(result.returncode)
            _write(coordinator_path, payload)
        payload["status"] = "complete"
        payload["finished_at"] = datetime.now().isoformat(timespec="seconds")
        _write(coordinator_path, payload)
    except BaseException:
        if payload.get("status") == "running":
            payload["status"] = "failed"
            payload["finished_at"] = datetime.now().isoformat(timespec="seconds")
            _write(coordinator_path, payload)
        raise


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=["smoke", "pilot", "all"], default="all")
    args = parser.parse_args()
    run_batch(args.phase)


if __name__ == "__main__":
    main()
