from __future__ import annotations

import argparse
import json
import traceback
from datetime import datetime
from pathlib import Path

from .config import load_config
from .train import train


def write_status(path: Path, batch_id: str, status: str, seed: int, completed: int, total: int, error: str | None = None) -> None:
    payload = {
        "status": status,
        "batch_id": batch_id,
        "current_seed": seed,
        "completed_seed_count": completed,
        "total_seed_count": total,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
        "error": error,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--timesteps", type=int)
    parser.add_argument("--batch-id")
    args = parser.parse_args()
    config = load_config(args.config)
    seeds = [int(seed) for seed in config["experiments"]["model_seeds"]]
    timesteps = int(args.timesteps or config["experiments"]["final_timesteps_per_seed"])
    batch_id = args.batch_id or datetime.now().strftime("%Y%m%d_%H%M%S")
    status_path = Path(config["paths"]["artifacts_dir"]) / "training_coordinator.json"
    write_status(status_path, batch_id, "running", seeds[0], 0, len(seeds))
    try:
        for index, seed in enumerate(seeds):
            write_status(status_path, batch_id, "running", seed, index, len(seeds))
            train(
                args.config,
                timesteps,
                seed=seed,
                run_name=f"final_v2_seed{seed}_{batch_id}",
                vec_env="SubprocVecEnv",
            )
            write_status(status_path, batch_id, "running", seed, index + 1, len(seeds))
    except Exception:
        error = traceback.format_exc()
        write_status(status_path, batch_id, "failed", seed, index, len(seeds), error)
        raise
    write_status(status_path, batch_id, "complete", 0, len(seeds), len(seeds))


if __name__ == "__main__":
    main()
