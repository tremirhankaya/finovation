from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
from stable_baselines3 import PPO

from .config import load_config
from .constraints import ProspectusConstraints
from .decoder import FeasibleActionDecoder
from .env import BistStressEnv
from .portfolio import PortfolioBook
from .runtime import build_runtime


def fit_robust_ood_reference(observations: np.ndarray, output_path: str | Path) -> Path:
    values = np.asarray(observations, dtype=np.float64)
    if values.ndim != 2 or len(values) < 100 or not np.isfinite(values).all():
        raise ValueError("OOD reference requires at least 100 finite observation rows")
    median = np.median(values, axis=0)
    mad = np.median(np.abs(values - median), axis=0)
    robust_scale = np.maximum(1.4826 * mad, 0.05)
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        output,
        median=median,
        robust_scale=robust_scale,
        samples=np.asarray([len(values)], dtype=np.int64),
        dimension=np.asarray([values.shape[1]], dtype=np.int64),
    )
    return output


def score_ood(observation: np.ndarray, reference_path: str | Path | None) -> dict[str, Any]:
    if reference_path is None:
        return {
            "available": False,
            "is_ood": None,
            "confidence": None,
            "reason": "OOD_REFERENCE_NOT_PROVIDED",
        }
    reference = np.load(reference_path)
    value = np.asarray(observation, dtype=np.float64).reshape(-1)
    median = np.asarray(reference["median"], dtype=np.float64)
    scale = np.asarray(reference["robust_scale"], dtype=np.float64)
    if value.shape != median.shape:
        raise ValueError("Observation and OOD reference dimensions disagree")
    robust_z = np.abs(value - median) / scale
    max_z = float(robust_z.max())
    p95_z = float(np.quantile(robust_z, 0.95))
    fraction_gt_5 = float(np.mean(robust_z > 5.0))
    is_ood = bool(max_z > 8.0 or fraction_gt_5 > 0.05)
    confidence = float(np.clip(np.exp(-max(0.0, p95_z - 2.0) / 4.0), 0.0, 1.0))
    return {
        "available": True,
        "is_ood": is_ood,
        "confidence": confidence,
        "max_robust_z": max_z,
        "p95_robust_z": p95_z,
        "fraction_dimensions_gt_5": fraction_gt_5,
        "reference_samples": int(np.asarray(reference["samples"]).item()),
        "reason": "STATE_OUTSIDE_ROBUST_TRAINING_BAND" if is_ood else "STATE_INSIDE_ROBUST_TRAINING_BAND",
    }


def _load_model(model: PPO | str | Path, device: str) -> PPO:
    return model if hasattr(model, "predict") else PPO.load(model, device=device)


def predict_portfolio(
    model: PPO | str | Path,
    observation: np.ndarray,
    current_weights: np.ndarray,
    *,
    config_path: str | Path = "config.yaml",
    current_nav_try: float | None = None,
    ood_reference_path: str | Path | None = None,
    deterministic: bool = True,
    final_session: bool = False,
) -> dict[str, Any]:
    """Single-call policy inference with legal target, trades and reason codes."""

    config = load_config(config_path)
    tickers = list(config["universe"]["tickers"])
    symbols = tickers + [str(config["universe"]["tpp_symbol"])]
    observation = np.asarray(observation, dtype=np.float32).reshape(-1)
    current = np.asarray(current_weights, dtype=np.float64).reshape(-1)
    if observation.shape != (int(config["observation"]["dimension"]),):
        raise ValueError("Observation dimension does not match the model contract")
    if current.shape != (len(symbols),) or not np.isfinite(current).all():
        raise ValueError("Current weights do not match the fixed portfolio universe")
    if abs(float(current.sum()) - 1.0) > 1e-8:
        raise ValueError("Current weights must sum to one")

    policy = _load_model(model, str(config["ppo"]["device"]))
    raw_action, _state = policy.predict(observation, deterministic=deterministic)
    raw_action = np.asarray(raw_action, dtype=np.float64).reshape(-1)
    decoder = FeasibleActionDecoder(config, len(tickers))
    constraints = ProspectusConstraints(config["constraints"], len(tickers))
    current_validation = constraints.validate(current)
    decoded = decoder.decode(raw_action, current)
    target = decoded.target_weights.copy()
    status = decoded.status
    proposed_turnover = 0.5 * float(np.abs(target - current).sum())
    execute = status != "HOLD"
    reason_codes: list[str] = []
    if not current_validation.ok:
        reason_codes.append("PROSPECTUS_DRIFT_FORCED")
    elif status == "HOLD":
        reason_codes.append("POLICY_HOLD_GATE")
    else:
        reason_codes.append("POLICY_REBALANCE_GATE")
    if final_session and current_validation.ok:
        execute = False
        target = current.copy()
        status = "TERMINAL_HOLD"
        reason_codes.append("TERMINAL_VALUATION_ONLY")
    minimum_turnover = float(config["action"]["minimum_one_way_turnover_to_execute"])
    if execute and proposed_turnover < minimum_turnover and current_validation.ok:
        execute = False
        target = current.copy()
        status = "MIN_TURNOVER_HOLD"
        reason_codes.append("BELOW_MINIMUM_TURNOVER")

    nav = float(current_nav_try or config["project"]["initial_nav_try"])
    trades = np.zeros(len(tickers), dtype=np.float64)
    commission = 0.0
    turnover = 0.0
    post_weights = current.copy()
    if execute:
        book = PortfolioBook(
            nav,
            current,
            np.ones(len(tickers), dtype=np.float64),
            float(config["accounting"]["buy_commission_rate"]),
            float(config["accounting"]["sell_commission_rate"]),
        )
        result = book.rebalance(target, np.ones(len(tickers), dtype=np.float64))
        trades = result.equity_trades
        commission = result.commission
        turnover = result.turnover
        post_weights = result.weights_after
    target_validation = constraints.validate(post_weights)
    if not target_validation.ok:
        raise RuntimeError(f"Inference produced illegal applied weights: {target_validation.violations}")

    bound_dimensions = np.flatnonzero(np.abs(raw_action) >= 0.999).astype(int).tolist()
    if bound_dimensions:
        reason_codes.append("ACTION_BOUND_HIT")
    ood = score_ood(observation, ood_reference_path)
    if ood.get("is_ood"):
        reason_codes.append("OOD_STATE")
    confidence = ood.get("confidence")
    if confidence is None:
        confidence = 1.0 if not bound_dimensions else 0.75
    elif bound_dimensions:
        confidence = min(float(confidence), 0.75)

    trade_rows = []
    for ticker, amount in zip(tickers, trades):
        trade_rows.append(
            {
                "instrument": ticker,
                "side": "BUY" if amount > 1e-9 else "SELL" if amount < -1e-9 else "HOLD",
                "trade_try": float(amount),
            }
        )
    return {
        "schema_version": "portfolio_decision_v1",
        "status": status,
        "execute": bool(execute),
        "reason_codes": reason_codes,
        "confidence": float(confidence),
        "raw_action": raw_action.tolist(),
        "action_bound_hit_dimensions": bound_dimensions,
        "requested_heavy_count": int(decoded.requested_heavy_count),
        "applied_heavy_count": int(decoded.applied_heavy_count),
        "current_validation": {
            "ok": current_validation.ok,
            "violations": list(current_validation.violations),
        },
        "target_validation": {
            "ok": target_validation.ok,
            "violations": list(target_validation.violations),
        },
        "current_weights": dict(zip(symbols, current.astype(float))),
        "decoded_target_weights": dict(zip(symbols, decoded.target_weights.astype(float))),
        "applied_target_weights": dict(zip(symbols, post_weights.astype(float))),
        "proposed_one_way_turnover": proposed_turnover,
        "executed_one_way_turnover": turnover,
        "estimated_commission_try": commission,
        "expected_equity_trades": trade_rows,
        "ood": ood,
        "warning": (
            "Current V2 forced-compliance timing is diagnostic-only pending the V2.1 causal timing fix"
            if not current_validation.ok
            else None
        ),
    }


def build_policy_ood_reference(
    config_path: str | Path,
    model_path: str | Path,
    output_path: str | Path,
    *,
    episodes: int = 128,
    seed: int = 20260808,
) -> Path:
    runtime = build_runtime(str(config_path))
    model = PPO.load(model_path, device=runtime.config["ppo"]["device"])
    rng = np.random.default_rng(seed)
    observations: list[np.ndarray] = []
    for episode in range(int(episodes)):
        path_seed = int(rng.integers(1, 2**31 - 1))
        path = runtime.scenarios.sample(
            np.random.default_rng(path_seed), split="train", scenario_seed=path_seed
        )
        env = BistStressEnv(runtime.config, runtime.scenarios, split="train")
        observation, _ = env.reset(options={"scenario_path": path})
        done = False
        while not done:
            observations.append(observation.copy())
            action, _state = model.predict(observation, deterministic=True)
            observation, _, terminated, truncated, _ = env.step(action)
            done = bool(terminated or truncated)
        env.close()
        if (episode + 1) % 16 == 0:
            print(f"OOD_REFERENCE_PROGRESS {episode + 1}/{episodes}", flush=True)
    return fit_robust_ood_reference(np.asarray(observations), output_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    build = subparsers.add_parser("build-ood")
    build.add_argument("--config", default="config.yaml")
    build.add_argument("--model", required=True)
    build.add_argument("--output", required=True)
    build.add_argument("--episodes", type=int, default=128)
    build.add_argument("--seed", type=int, default=20260808)
    args = parser.parse_args()
    if args.command == "build-ood":
        output = build_policy_ood_reference(
            args.config,
            args.model,
            args.output,
            episodes=args.episodes,
            seed=args.seed,
        )
        print(f"OOD_REFERENCE_COMPLETE {output}", flush=True)


if __name__ == "__main__":
    main()
