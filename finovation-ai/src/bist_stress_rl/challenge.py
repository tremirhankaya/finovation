from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from stable_baselines3 import PPO

from .counterfactual import _run_episode
from .env import BistStressEnv
from .evaluate import _baseline_targets, _trade_blotter
from .evidence import sha256_file, write_hash_manifest
from .inference import score_ood
from .runtime import Runtime, build_runtime
from .scenarios import ScenarioPath


def _read_equity_csv(path: Path, ticker: str) -> pd.DataFrame:
    frame = pd.read_csv(path)
    expected = {
        "Tarih",
        "Segment",
        f"{ticker}_Acilis",
        f"{ticker}_Kapanis",
    }
    missing = expected.difference(frame.columns)
    if missing:
        raise ValueError(f"{path} is missing columns: {sorted(missing)}")
    frame["Tarih"] = pd.to_datetime(frame["Tarih"], errors="raise")
    frame = frame.sort_values("Tarih", kind="stable").reset_index(drop=True)
    for column in (f"{ticker}_Acilis", f"{ticker}_Kapanis"):
        frame[column] = pd.to_numeric(frame[column], errors="raise")
    if frame["Tarih"].duplicated().any() or (frame[[f"{ticker}_Acilis", f"{ticker}_Kapanis"]] <= 0).any().any():
        raise ValueError(f"{path} contains duplicate dates or non-positive prices")
    return frame


def _read_tpp_csv(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path)
    expected = {"Tarih", "TPP_AgirlikliOrt"}
    missing = expected.difference(frame.columns)
    if missing:
        raise ValueError(f"{path} is missing columns: {sorted(missing)}")
    frame["Tarih"] = pd.to_datetime(frame["Tarih"], errors="raise")
    frame["TPP_AgirlikliOrt"] = pd.to_numeric(frame["TPP_AgirlikliOrt"], errors="raise")
    frame = frame.sort_values("Tarih", kind="stable").reset_index(drop=True)
    if frame["Tarih"].duplicated().any() or (frame["TPP_AgirlikliOrt"] <= 0).any():
        raise ValueError(f"{path} contains duplicate dates or non-positive rates")
    return frame


def load_challenge_paths(runtime: Runtime, package_dir: str | Path) -> tuple[list[ScenarioPath], dict[str, Any]]:
    """Load the four user-supplied scenario folders without adding them to training.

    The first scenario-day opening prices are the execution starting prices and the
    first closes are day-one closing prices. The 20-session feature warm-up is a
    fixed train-only historical block rescaled to those openings. The package has
    no FX path, so scenario-period FX is held flat and explicitly audited.
    """

    root = Path(package_dir).resolve()
    if not root.is_dir():
        raise FileNotFoundError(root)
    tickers = list(runtime.config["universe"]["tickers"])
    lookback = int(runtime.config["data"]["lookback_sessions"])
    rng = np.random.default_rng(20260808)
    warmup_start = runtime.market.contiguous_start(rng, lookback, "train")
    warmup_returns = runtime.market.returns[warmup_start : warmup_start + lookback].copy()
    warmup_fx = runtime.market.fx_returns[warmup_start : warmup_start + lookback].copy()
    paths: list[ScenarioPath] = []
    audit_rows: list[dict[str, Any]] = []

    scenario_dirs = sorted(path for path in root.iterdir() if path.is_dir())
    if not scenario_dirs:
        raise ValueError(f"No scenario directories found under {root}")
    for scenario_index, scenario_dir in enumerate(scenario_dirs, start=1):
        equity_frames = [_read_equity_csv(scenario_dir / f"{ticker}.csv", ticker) for ticker in tickers]
        dates = equity_frames[0]["Tarih"]
        for ticker, frame in zip(tickers[1:], equity_frames[1:]):
            if not frame["Tarih"].equals(dates):
                raise ValueError(f"Date mismatch for {scenario_dir.name}/{ticker}")
        tpp = _read_tpp_csv(scenario_dir / "TPP_ON.csv")
        if not tpp["Tarih"].equals(dates):
            raise ValueError(f"TPP date mismatch for {scenario_dir.name}")

        openings = np.column_stack(
            [frame[f"{ticker}_Acilis"].to_numpy(dtype=np.float64) for ticker, frame in zip(tickers, equity_frames)]
        )
        closes = np.column_stack(
            [frame[f"{ticker}_Kapanis"].to_numpy(dtype=np.float64) for ticker, frame in zip(tickers, equity_frames)]
        )
        horizon = len(dates)
        prices = np.empty((lookback + horizon + 1, len(tickers)), dtype=np.float64)
        prices[lookback] = openings[0]
        for index in range(lookback - 1, -1, -1):
            prices[index] = prices[index + 1] / np.exp(warmup_returns[index])
        prices[lookback + 1 :] = closes

        fx_levels = np.empty(lookback + horizon + 1, dtype=np.float64)
        fx_levels[lookback] = 1.0
        for index in range(lookback - 1, -1, -1):
            fx_levels[index] = fx_levels[index + 1] / np.exp(warmup_fx[index])
        fx_levels[lookback + 1 :] = 1.0

        date_gaps = dates.diff().dt.days.fillna(1).clip(1, 7).to_numpy(dtype=np.int32)
        segments = equity_frames[0]["Segment"].fillna("UNSPECIFIED").astype(str).tolist()
        path = ScenarioPath(
            family=scenario_dir.name,
            scenario_seed=1_100_000 + scenario_index,
            dates=dates.dt.strftime("%Y-%m-%d").tolist(),
            prices=prices,
            fx_levels=fx_levels,
            tpp_annual_rates=tpp["TPP_AgirlikliOrt"].to_numpy(dtype=np.float64),
            calendar_accrual_days=date_gaps,
            segments=segments,
            lookback=lookback,
        )
        paths.append(path)
        audit_rows.append(
            {
                "scenario": scenario_dir.name,
                "days": horizon,
                "first_date": str(dates.iloc[0].date()),
                "last_date": str(dates.iloc[-1].date()),
                "equities": len(tickers),
                "fx_assumption": "flat_during_scenario_due_to_missing_fx_path",
                "warmup_source": "fixed_train_only_historical_block_rescaled_to_first_open",
                "first_day_return_definition": "first_open_to_first_close",
            }
        )

    audit = {
        "package_dir": str(root),
        "scenario_count": len(paths),
        "training_access": False,
        "validation_access": False,
        "challenge_only": True,
        "warmup_return_start_index": int(warmup_start),
        "warmup_dates": [
            str(runtime.market.dates[warmup_start])[:10],
            str(runtime.market.dates[warmup_start + lookback])[:10],
        ],
        "scenarios": audit_rows,
    }
    return paths, audit


def _model_seed(path: Path) -> int:
    for part in path.parts:
        if "seed" not in part:
            continue
        suffix = part.split("seed", 1)[1].split("_", 1)[0]
        if suffix.isdigit():
            return int(suffix)
    raise ValueError(f"Could not infer model seed from {path}")


def run_external_challenge(
    config_path: str,
    package_dir: str,
    model_paths: list[str],
    output_name: str,
    ood_reference_dir: str | None = None,
) -> Path:
    runtime = build_runtime(config_path)
    paths, data_audit = load_challenge_paths(runtime, package_dir)
    output_dir = Path(runtime.config["paths"]["report_root"]) / output_name
    output_dir.mkdir(parents=True, exist_ok=True)
    static_target = _baseline_targets(runtime)["TRAIN_ONLY_DEFENSIVE_DOWNSIDE_BETA"]
    strategies = (
        ("POLICY_ORIGINAL", "POLICY_ORIGINAL", None),
        ("POLICY_FORCED_ONLY", "POLICY_FORCED_ONLY", None),
        ("MECHANICAL_MIN_TURNOVER_COMPLIANCE", "MECHANICAL_MIN_TURNOVER_COMPLIANCE", None),
        ("STATIC_DEFENSIVE_COMPLIANCE", "STATIC_TARGET_COMPLIANCE", static_target),
    )
    metrics_rows: list[dict[str, Any]] = []
    daily_frames: list[pd.DataFrame] = []
    model_manifest: list[dict[str, Any]] = []
    ood_rows: list[dict[str, Any]] = []
    for model_path_text in model_paths:
        model_path = Path(model_path_text).resolve()
        seed = _model_seed(model_path)
        model = PPO.load(str(model_path), device="cpu")
        model_manifest.append(
            {
                "seed": seed,
                "path": str(model_path),
                "bytes": int(model_path.stat().st_size),
                "sha256": sha256_file(model_path),
            }
        )
        provider = lambda observation, day, loaded=model: loaded.predict(observation, deterministic=True)[0]
        reference = None
        if ood_reference_dir is not None:
            candidate = Path(ood_reference_dir) / f"ood_reference_seed{seed}.npz"
            if not candidate.exists():
                raise FileNotFoundError(candidate)
            reference = candidate
        for path in paths:
            for strategy, execution_policy, target in strategies:
                metrics, daily = _run_episode(
                    runtime,
                    path,
                    seed,
                    strategy,
                    execution_policy=execution_policy,
                    action_provider=provider,
                    compliance_target=target,
                )
                metrics_rows.append(metrics)
                daily_frames.append(daily)
            if reference is not None:
                env = BistStressEnv(runtime.config, runtime.scenarios, split="test")
                observation, _ = env.reset(options={"scenario_path": path})
                done = False
                day = 0
                while not done:
                    ood = score_ood(observation, reference)
                    ood_rows.append(
                        {
                            "model_seed": seed,
                            "family": path.family,
                            "scenario_day": day + 1,
                            "date": path.dates[day],
                            "is_ood": bool(ood["is_ood"]),
                            "confidence": float(ood["confidence"]),
                            "max_robust_z": float(ood["max_robust_z"]),
                            "p95_robust_z": float(ood["p95_robust_z"]),
                            "fraction_dimensions_gt_5": float(ood["fraction_dimensions_gt_5"]),
                        }
                    )
                    action, _ = model.predict(observation, deterministic=True)
                    observation, _, terminated, truncated, _ = env.step(action)
                    done = bool(terminated or truncated)
                    day += 1
                env.close()

    metrics = pd.DataFrame(metrics_rows)
    daily = pd.concat(daily_frames, ignore_index=True)
    metrics.to_csv(output_dir / "challenge_metrics.csv", index=False)
    daily.to_parquet(output_dir / "challenge_daily.parquet", index=False)
    symbols = runtime.config["universe"]["tickers"] + [runtime.config["universe"]["tpp_symbol"]]
    _trade_blotter(daily, symbols).to_parquet(output_dir / "challenge_full_blotter.parquet", index=False)
    summary = metrics.groupby(["strategy", "family"], as_index=False).agg(
        seeds=("model_seed", "nunique"),
        mean_terminal_return=("terminal_return", "mean"),
        mean_excess_return=("excess_terminal_return", "mean"),
        mean_max_drawdown=("max_drawdown", "mean"),
        mean_mdd_improvement=("mdd_improvement", "mean"),
        mean_turnover=("total_turnover", "mean"),
        mean_commission_try=("total_commission_try", "mean"),
        mean_trade_days=("trade_days", "mean"),
        illegal_days=("illegal_days", "sum"),
    )
    summary.to_csv(output_dir / "challenge_summary.csv", index=False)
    original = metrics[metrics["strategy"] == "POLICY_ORIGINAL"]
    forced = metrics[metrics["strategy"] == "POLICY_FORCED_ONLY"]
    paired = original.merge(forced, on=["model_seed", "path_id", "family"], suffixes=("_original", "_forced"))
    paired["voluntary_timing_return_effect"] = paired["terminal_return_original"] - paired["terminal_return_forced"]
    paired["voluntary_timing_mdd_effect"] = paired["max_drawdown_forced"] - paired["max_drawdown_original"]
    paired.to_csv(output_dir / "challenge_original_vs_forced.csv", index=False)
    ood_report_lines: list[str] = []
    if ood_rows:
        ood_daily = pd.DataFrame(ood_rows)
        ood_daily.to_csv(output_dir / "challenge_ood_daily.csv", index=False)
        ood_summary = ood_daily.groupby(["family", "model_seed"], as_index=False).agg(
            days=("scenario_day", "count"),
            ood_day_fraction=("is_ood", "mean"),
            mean_confidence=("confidence", "mean"),
            mean_p95_robust_z=("p95_robust_z", "mean"),
            max_robust_z=("max_robust_z", "max"),
            mean_fraction_dimensions_gt_5=("fraction_dimensions_gt_5", "mean"),
        )
        ood_summary.to_csv(output_dir / "challenge_ood_summary.csv", index=False)
        ood_report_lines = [
            "",
            "## OOD audit",
            "",
            f"Overall OOD day fraction: {ood_daily['is_ood'].mean():.2%}",
            f"Mean OOD confidence score: {ood_daily['confidence'].mean():.4f}",
            "The missing scenario FX path and flat-FX assumption are possible contributors; the score is diagnostic, not a causal attribution.",
        ]
    data_audit["models"] = model_manifest
    (output_dir / "challenge_data_audit.json").write_text(
        json.dumps(data_audit, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    report = [
        "# External Four-Scenario Challenge",
        "",
        "These four paths are challenge-only and were not used for training or validation.",
        "The source package has no FX scenario path; FX is therefore held flat during each challenge. This is a material limitation.",
        "The first opening price is the starting valuation and the first close is the first daily execution close.",
        "",
        "## Strategy / scenario means",
        "",
        "```text",
        summary.to_string(index=False),
        "```",
        "",
        "## Voluntary timing isolation",
        "",
        f"Mean return effect (original minus forced-only): {paired['voluntary_timing_return_effect'].mean():.6%}",
        f"Mean MDD improvement (forced-only MDD minus original MDD): {paired['voluntary_timing_mdd_effect'].mean():.6%}",
        "",
        "Interpretation must remain challenge-specific because there are only four unique paths.",
        *ood_report_lines,
    ]
    (output_dir / "CHALLENGE_REPORT.md").write_text("\n".join(report), encoding="utf-8")
    write_hash_manifest(
        output_dir / "output_hashes.json",
        files=[path for path in output_dir.iterdir() if path.is_file() and path.name != "output_hashes.json"],
        paths=paths,
        metadata={"challenge_only": True, "training_access": False, "validation_access": False},
    )
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--package-dir", required=True)
    parser.add_argument("--models", nargs="+", required=True)
    parser.add_argument("--output-name", default="external_four_scenario_challenge")
    parser.add_argument("--ood-reference-dir")
    args = parser.parse_args()
    print(
        run_external_challenge(
            args.config,
            args.package_dir,
            args.models,
            args.output_name,
            ood_reference_dir=args.ood_reference_dir,
        )
    )


if __name__ == "__main__":
    main()
