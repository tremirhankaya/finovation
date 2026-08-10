from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

import pandas as pd


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


def _progress(root: Path, training: dict) -> dict:
    completed_steps = sum(int(job["timesteps"]) for job in training.get("completed", []))
    current = training.get("current_job")
    current_steps = 0
    current_percent = 0.0
    current_speed = None
    current_eta = None
    if current and current.get("run_name"):
        matches = list((root / "artifacts_v22").glob(f"**/{current['run_name']}/progress.csv"))
        if matches:
            frame = pd.read_csv(matches[0])
            if not frame.empty:
                last = frame.iloc[-1]
                current_steps = int(last["timesteps"])
                current_percent = float(last["percent"])
                current_speed = float(last["steps_per_second"])
                current_eta = float(last["eta_seconds"])
    total_steps = sum(int(job["timesteps"]) for job in training.get("jobs", []))
    overall = 100.0 * (completed_steps + current_steps) / max(total_steps, 1)
    return {
        "current_seed": int(current["seed"]) if current else None,
        "current_run": current.get("run_name") if current else None,
        "current_steps": current_steps,
        "current_percent": current_percent,
        "steps_per_second": current_speed,
        "current_eta_seconds": current_eta,
        "overall_percent": overall,
        "completed_seeds": len(training.get("completed", [])),
        "total_seeds": len(training.get("jobs", [])),
    }


def run() -> None:
    root = Path.cwd().resolve()
    pipeline = root / "artifacts_v22" / "pipeline"
    training_path = pipeline / "final_training_coordinator.json"
    watchdog_path = pipeline / "pipeline_watchdog.json"
    log_path = pipeline / "execution_log.jsonl"
    last_bucket = None
    _log(log_path, "watchdog_started")
    while True:
        if not training_path.exists():
            _write(watchdog_path, {"status": "waiting_for_training_coordinator", "updated_at": _now()})
            time.sleep(10)
            continue
        training = json.loads(training_path.read_text(encoding="utf-8"))
        progress = _progress(root, training)
        status = training.get("status")
        _write(
            watchdog_path,
            {
                "status": "monitoring_final_training" if status == "running" else status,
                "updated_at": _now(),
                "training_status": status,
                **progress,
            },
        )
        bucket = (progress["current_seed"], int(progress["current_percent"] // 10))
        if bucket != last_bucket:
            _log(log_path, "watchdog_training_progress", **progress)
            last_bucket = bucket
        if status == "complete":
            break
        if status == "failed":
            _write(watchdog_path, {"status": "failed", "updated_at": _now(), "training_error": training.get("error"), **progress})
            _log(log_path, "watchdog_stopped_training_failed", error=training.get("error"))
            raise RuntimeError(training.get("error", "Final training failed"))
        time.sleep(30)

    _write(watchdog_path, {"status": "running_postfinal", "updated_at": _now(), **progress})
    _log(log_path, "watchdog_postfinal_started")
    from .postfinal_v22 import run as run_postfinal

    last_error = None
    for attempt in [1, 2]:
        try:
            output = run_postfinal()
            _write(watchdog_path, {"status": "complete", "updated_at": _now(), "delivery_dir": str(output.resolve()), **progress})
            _log(log_path, "watchdog_complete", delivery_dir=str(output.resolve()))
            return
        except BaseException as exc:
            last_error = repr(exc)
            _log(log_path, "watchdog_postfinal_attempt_failed", attempt=attempt, error=last_error)
            if attempt == 1:
                time.sleep(10)
    _write(watchdog_path, {"status": "failed", "updated_at": _now(), "postfinal_error": last_error, **progress})
    raise RuntimeError(last_error)


def main() -> None:
    argparse.ArgumentParser().parse_args()
    run()


if __name__ == "__main__":
    main()
