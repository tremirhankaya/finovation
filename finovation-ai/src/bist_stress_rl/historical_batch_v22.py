from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from .historical_v22 import evaluate_historical


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
    pipeline_root = root / "artifacts_v22" / "pipeline"
    inventory = json.loads((pipeline_root / "pilot_inventory.json").read_text(encoding="utf-8"))
    jobs = inventory["jobs"]
    coordinator_path = pipeline_root / "historical_coordinator.json"
    log_path = pipeline_root / "execution_log.jsonl"
    coordinator = {
        "schema_version": "bist_stress_rl_v22_historical_batch",
        "status": "running",
        "started_at": _now(),
        "jobs_total": len(jobs),
        "jobs_completed": 0,
        "current_job": None,
        "completed": [],
    }
    _write(coordinator_path, coordinator)
    try:
        for index, job in enumerate(jobs, start=1):
            output_name = f"pilot_historical_{job['run_name']}"
            current = {**job, "index": index, "output_name": output_name, "started_at": _now()}
            coordinator["current_job"] = current
            _write(coordinator_path, coordinator)
            _log(log_path, "historical_replay_started", model_id=job["model_id"], seed=job["seed"])
            output_dir = evaluate_historical(job["config"], job["model_path"], output_name)
            completed = {**current, "finished_at": _now(), "status": "complete", "output_dir": str(output_dir.resolve())}
            coordinator["completed"].append(completed)
            coordinator["jobs_completed"] = len(coordinator["completed"])
            coordinator["current_job"] = None
            _write(coordinator_path, coordinator)
            _log(log_path, "historical_replay_complete", model_id=job["model_id"], seed=job["seed"], output_dir=str(output_dir.resolve()))
        coordinator["status"] = "complete"
        coordinator["finished_at"] = _now()
        _write(coordinator_path, coordinator)
        _log(log_path, "historical_batch_complete", jobs=len(jobs))
    except BaseException as exc:
        coordinator["status"] = "failed"
        coordinator["finished_at"] = _now()
        coordinator["error"] = repr(exc)
        _write(coordinator_path, coordinator)
        _log(log_path, "historical_batch_failed", error=repr(exc))
        raise


def main() -> None:
    argparse.ArgumentParser().parse_args()
    run()


if __name__ == "__main__":
    main()
