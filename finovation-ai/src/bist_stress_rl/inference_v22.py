from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from stable_baselines3 import PPO

from .config import load_config
from .decoder_v22 import DeltaFeasibleDecoderV22


def predict(
    config_path: str,
    model_path: str,
    observation_path: str,
    previous_target_path: str,
    *,
    stress_active: bool,
    elapsed_sessions: int,
    switch_ages_path: str | None = None,
) -> dict:
    config = load_config(config_path)
    observation = np.load(observation_path).astype(np.float32).reshape(-1)
    expected = int(config["observation"]["dimension"])
    if observation.shape != (expected,):
        raise ValueError(f"Expected observation shape {(expected,)}, got {observation.shape}")
    previous_payload = json.loads(Path(previous_target_path).read_text(encoding="utf-8"))
    symbols = list(config["universe"]["tickers"]) + [config["universe"]["tpp_symbol"]]
    previous = np.asarray([previous_payload[symbol] for symbol in symbols], dtype=np.float64)
    switch_ages = None
    if switch_ages_path:
        ages_payload = json.loads(Path(switch_ages_path).read_text(encoding="utf-8"))
        switch_ages = np.asarray([ages_payload[symbol] for symbol in symbols[:-1]], dtype=np.int32)
    model = PPO.load(model_path, device=config["ppo"]["device"])
    action, _ = model.predict(observation, deterministic=True)
    decoded = DeltaFeasibleDecoderV22(config).decode(
        action,
        previous,
        stress_active=stress_active,
        elapsed_sessions=int(elapsed_sessions),
        switch_ages=switch_ages,
    )
    return {
        "model_id": config["model"]["id"],
        "state_dimension": expected,
        "raw_action": np.asarray(action, dtype=float).tolist(),
        "decoded_status": decoded.status,
        "target_weights": {
            symbol: float(weight) for symbol, weight in zip(symbols, decoded.target_weights)
        },
        "target_change_turnover": float(decoded.target_change_turnover),
        "requested_heavy_count": int(decoded.requested_heavy_count),
        "applied_heavy_count": int(decoded.applied_heavy_count),
        "heavy_sum": float(decoded.heavy_sum),
        "budget": float(decoded.budget),
        "budget_saturated": bool(decoded.budget_saturated),
        "prospectus_hard_decoder_applied": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--observation-npy", required=True)
    parser.add_argument("--previous-target-json", required=True)
    parser.add_argument("--stress-active", action="store_true")
    parser.add_argument("--elapsed-sessions", type=int, default=0)
    parser.add_argument("--switch-ages-json")
    parser.add_argument("--output")
    args = parser.parse_args()
    payload = predict(
        args.config,
        args.model,
        args.observation_npy,
        args.previous_target_json,
        stress_active=args.stress_active,
        elapsed_sessions=args.elapsed_sessions,
        switch_ages_path=args.switch_ages_json,
    )
    rendered = json.dumps(payload, indent=2, ensure_ascii=False)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
