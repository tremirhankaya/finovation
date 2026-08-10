from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from .config import load_config


CONFIG_BY_MODEL = {
    "P0_SCENARIO_BLIND": "configs_v22/model_p0_scenario_blind.yaml",
    "P1_SCENARIO_CONDITIONED": "configs_v22/model_p1_scenario_conditioned.yaml",
}


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def _log(path: Path, event: str, **fields: object) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": _now(), "event": event, **fields}, ensure_ascii=False) + "\n")


def run() -> None:
    root = Path.cwd().resolve()
    pipeline = root / "artifacts_v22" / "pipeline"
    selection = json.loads(
        (pipeline / "pilot_analysis" / "provisional_selection.json").read_text(encoding="utf-8")
    )
    if not selection["technical_gates_pass"]:
        raise RuntimeError("Final training forbidden because technical gates failed")
    model_id = selection["selected_deployable_model_type"]
    config_path = CONFIG_BY_MODEL[model_id]
    config = load_config(config_path)
    seeds = [int(seed) for seed in config["experiments"]["final_seeds"]]
    timesteps = int(config["experiments"]["final_timesteps_per_seed"])
    jobs = [
        {"index": index, "model_id": model_id, "config": config_path, "seed": seed, "timesteps": timesteps}
        for index, seed in enumerate(seeds, start=1)
    ]
    coordinator_path = pipeline / "final_training_coordinator.json"
    log_path = pipeline / "execution_log.jsonl"
    coordinator = {
        "schema_version": "bist_stress_rl_v22_final_training",
        "status": "running",
        "started_at": _now(),
        "selected_model_type": model_id,
        "jobs_total": len(jobs),
        "jobs_completed": 0,
        "current_job": None,
        "jobs": jobs,
        "completed": [],
    }
    _write(coordinator_path, coordinator)
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(root / "src")
    try:
        for job in jobs:
            succeeded = False
            for attempt in [1, 2]:
                run_name = f"final_{model_id.lower()}_seed{job['seed']}_attempt{attempt}_{datetime.now():%Y%m%d_%H%M%S}"
                batch_log = pipeline / f"{run_name}.log"
                current = {
                    **job,
                    "attempt": attempt,
                    "run_name": run_name,
                    "batch_log": str(batch_log.resolve()),
                    "started_at": _now(),
                    "status": "running",
                }
                coordinator["current_job"] = current
                _write(coordinator_path, coordinator)
                _log(log_path, "final_training_started", model_id=model_id, seed=job["seed"], attempt=attempt, run_name=run_name)
                command = [
                    sys.executable,
                    "-m",
                    "bist_stress_rl.train_v22",
                    "--config",
                    config_path,
                    "--timesteps",
                    str(timesteps),
                    "--seed",
                    str(job["seed"]),
                    "--vec-env",
                    "SubprocVecEnv",
                    "--run-name",
                    run_name,
                ]
                with batch_log.open("w", encoding="utf-8") as handle:
                    result = subprocess.run(
                        command,
                        cwd=root,
                        env=environment,
                        stdout=handle,
                        stderr=subprocess.STDOUT,
                        text=True,
                        check=False,
                    )
                current["finished_at"] = _now()
                current["exit_code"] = int(result.returncode)
                current["status"] = "complete" if result.returncode == 0 else "failed"
                _log(log_path, "final_training_attempt_finished", model_id=model_id, seed=job["seed"], attempt=attempt, exit_code=int(result.returncode))
                if result.returncode == 0:
                    model_root = "p1_scenario_conditioned" if model_id == "P1_SCENARIO_CONDITIONED" else "p0_scenario_blind"
                    run_dir = root / "artifacts_v22" / model_root / "runs" / run_name
                    manifest = json.loads((run_dir / "run_manifest.json").read_text(encoding="utf-8"))
                    current["run_dir"] = str(run_dir.resolve())
                    current["model_path"] = manifest["model_path"]
                    coordinator["completed"].append(dict(current))
                    coordinator["jobs_completed"] = len(coordinator["completed"])
                    coordinator["current_job"] = None
                    _write(coordinator_path, coordinator)
                    succeeded = True
                    break
                coordinator.setdefault("failed_attempts", []).append(dict(current))
                _write(coordinator_path, coordinator)
            if not succeeded:
                raise RuntimeError(f"Final seed {job['seed']} failed twice")
        coordinator["status"] = "complete"
        coordinator["finished_at"] = _now()
        _write(coordinator_path, coordinator)
        _log(log_path, "final_training_batch_complete", model_id=model_id, seeds=seeds)
    except BaseException as exc:
        coordinator["status"] = "failed"
        coordinator["finished_at"] = _now()
        coordinator["error"] = repr(exc)
        _write(coordinator_path, coordinator)
        _log(log_path, "final_training_batch_failed", error=repr(exc))
        raise


def main() -> None:
    argparse.ArgumentParser().parse_args()
    run()


if __name__ == "__main__":
    main()
