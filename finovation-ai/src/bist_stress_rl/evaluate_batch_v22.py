from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path

from .evaluate_v22 import evaluate_v22


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def _log(path: Path, event: str, **fields: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {"timestamp": _now(), "event": event, **fields}
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _pilot_jobs(root: Path) -> list[dict]:
    training = json.loads(
        (root / "artifacts_v22" / "training_coordinator.json").read_text(encoding="utf-8")
    )
    jobs: list[dict] = []
    for completed in training["completed_runs"]:
        if completed["phase"] != "pilot" or completed["status"] != "complete":
            continue
        model_root = {
            "P0_SCENARIO_BLIND": "p0_scenario_blind",
            "P1_SCENARIO_CONDITIONED": "p1_scenario_conditioned",
            "P2_EVENT_ORACLE": "p2_event_oracle",
        }[completed["model_id"]]
        run_dir = root / "artifacts_v22" / model_root / "runs" / completed["run_name"]
        manifest = json.loads((run_dir / "run_manifest.json").read_text(encoding="utf-8"))
        model_path = Path(manifest["model_path"])
        if not model_path.exists():
            raise FileNotFoundError(model_path)
        jobs.append(
            {
                "model_id": completed["model_id"],
                "seed": int(completed["seed"]),
                "run_name": completed["run_name"],
                "config": completed["config"],
                "run_dir": str(run_dir.resolve()),
                "model_path": str(model_path.resolve()),
                "model_sha256": _sha256(model_path),
                "config_sha256": _sha256(run_dir / "resolved_config.yaml"),
            }
        )
    if len(jobs) != 6:
        raise RuntimeError(f"Expected 6 completed pilot jobs, found {len(jobs)}")
    return jobs


def run(split: str) -> None:
    root = Path.cwd().resolve()
    pipeline_root = root / "artifacts_v22" / "pipeline"
    log_path = pipeline_root / "execution_log.jsonl"
    jobs = _pilot_jobs(root)
    inventory_path = pipeline_root / "pilot_inventory.json"
    _atomic_json(
        inventory_path,
        {
            "schema_version": "bist_stress_rl_v22_pilot_inventory",
            "frozen_at": _now(),
            "immutable_model_count": len(jobs),
            "jobs": jobs,
        },
    )
    coordinator_path = pipeline_root / f"evaluation_coordinator_{split}.json"
    coordinator = {
        "schema_version": "bist_stress_rl_v22_evaluation_batch",
        "split": split,
        "status": "running",
        "started_at": _now(),
        "jobs_total": len(jobs),
        "jobs_completed": 0,
        "current_job": None,
        "jobs": jobs,
        "completed": [],
    }
    _atomic_json(coordinator_path, coordinator)
    _log(
        log_path,
        "pilot_inventory_frozen",
        inventory_path=str(inventory_path),
        models=len(jobs),
    )
    try:
        for index, job in enumerate(jobs, start=1):
            output_name = f"pilot_{split}_{job['run_name']}"
            current = {**job, "index": index, "output_name": output_name, "started_at": _now()}
            coordinator["current_job"] = current
            _atomic_json(coordinator_path, coordinator)
            _log(
                log_path,
                "evaluation_started",
                split=split,
                model_id=job["model_id"],
                seed=job["seed"],
                output_name=output_name,
            )
            output_dir = evaluate_v22(
                job["config"],
                job["model_path"],
                output_name=output_name,
                split=split,
            )
            finished = {**current, "finished_at": _now(), "status": "complete", "output_dir": str(output_dir.resolve())}
            coordinator["completed"].append(finished)
            coordinator["jobs_completed"] = len(coordinator["completed"])
            coordinator["current_job"] = None
            _atomic_json(coordinator_path, coordinator)
            _log(
                log_path,
                "evaluation_complete",
                split=split,
                model_id=job["model_id"],
                seed=job["seed"],
                output_dir=str(output_dir.resolve()),
            )
        coordinator["status"] = "complete"
        coordinator["finished_at"] = _now()
        _atomic_json(coordinator_path, coordinator)
        _log(log_path, "evaluation_batch_complete", split=split, jobs=len(jobs))
    except BaseException as exc:
        coordinator["status"] = "failed"
        coordinator["finished_at"] = _now()
        coordinator["error"] = repr(exc)
        _atomic_json(coordinator_path, coordinator)
        _log(log_path, "evaluation_batch_failed", split=split, error=repr(exc))
        raise


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", choices=["validation", "test"], default="validation")
    args = parser.parse_args()
    run(args.split)


if __name__ == "__main__":
    main()
