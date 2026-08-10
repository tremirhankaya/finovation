from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pandas as pd
from stable_baselines3 import PPO

from .env import BistStressEnv
from .evaluate import _baseline_targets, _confidence_interval, _episode_metrics, _trade_blotter
from .evidence import hash_daily_trace, sha256_file, write_hash_manifest
from .runtime import Runtime, build_runtime
from .scenarios import ScenarioPath


def _path_id(path: ScenarioPath) -> str:
    return f"{path.family}_{int(path.scenario_seed):06d}"


def _with_identity(
    daily: pd.DataFrame,
    path: ScenarioPath,
    model_seed: int,
    strategy: str,
) -> pd.DataFrame:
    result = daily.copy()
    result.insert(0, "strategy", strategy)
    result.insert(0, "path_id", _path_id(path))
    result.insert(0, "model_seed", int(model_seed))
    return result


def _finish_metrics(
    daily: pd.DataFrame,
    runtime: Runtime,
    path: ScenarioPath,
    model_seed: int,
    strategy: str,
) -> dict[str, Any]:
    metrics = _episode_metrics(daily, float(runtime.config["project"]["initial_nav_try"]))
    metrics.update(
        {
            "strategy": strategy,
            "path_id": _path_id(path),
            "model_seed": int(model_seed),
        }
    )
    metrics["success"] = bool(
        metrics["illegal_days"] == 0
        and metrics["excess_terminal_return"] >= 0.0025
        and metrics["max_drawdown"] <= metrics["passive_max_drawdown"]
    )
    return metrics


def _run_episode(
    runtime: Runtime,
    path: ScenarioPath,
    model_seed: int,
    strategy: str,
    *,
    execution_policy: str,
    action_provider: Callable[[np.ndarray, int], np.ndarray],
    compliance_target: np.ndarray | None = None,
) -> tuple[dict[str, Any], pd.DataFrame]:
    env = BistStressEnv(
        runtime.config,
        runtime.scenarios,
        split="test",
        execution_policy=execution_policy,
        compliance_target=compliance_target,
    )
    observation, _ = env.reset(options={"scenario_path": path})
    done = False
    day = 0
    while not done:
        action = np.asarray(action_provider(observation, day), dtype=np.float32)
        observation, _, terminated, truncated, _ = env.step(action)
        done = bool(terminated or truncated)
        day += 1
    daily = _with_identity(pd.DataFrame(env.history), path, model_seed, strategy)
    env.close()
    return _finish_metrics(daily, runtime, path, model_seed, strategy), daily


def _stored_action_map(steps: pd.DataFrame) -> dict[tuple[int, str], np.ndarray]:
    result: dict[tuple[int, str], np.ndarray] = {}
    ordered = steps.sort_values(["model_seed", "path_id", "scenario_day"], kind="stable")
    for (seed, path_id), frame in ordered.groupby(["model_seed", "path_id"], sort=False):
        result[(int(seed), str(path_id))] = np.stack(
            [np.asarray(value, dtype=np.float32) for value in frame["raw_action"]]
        )
    return result


def _sequence_provider(actions: np.ndarray, lag: int = 0) -> Callable[[np.ndarray, int], np.ndarray]:
    def provider(_: np.ndarray, day: int) -> np.ndarray:
        source_day = max(0, day - lag)
        return actions[source_day]

    return provider


def _online_provider(model: PPO) -> Callable[[np.ndarray, int], np.ndarray]:
    def provider(observation: np.ndarray, _: int) -> np.ndarray:
        action, _state = model.predict(observation, deterministic=True)
        return np.asarray(action, dtype=np.float32)

    return provider


def _constant_provider(action_dimension: int) -> Callable[[np.ndarray, int], np.ndarray]:
    neutral = np.zeros(action_dimension, dtype=np.float32)
    return lambda _observation, _day: neutral


def _validation_policy_medoid(model: PPO, runtime: Runtime) -> tuple[np.ndarray, dict[str, Any]]:
    targets: list[np.ndarray] = []
    action_dimension = int(runtime.config["action"]["raw_dimension"])
    for path in runtime.scenarios.frozen_paths("validation"):
        env = BistStressEnv(runtime.config, runtime.scenarios, split="validation")
        observation, _ = env.reset(options={"scenario_path": path})
        done = False
        while not done:
            action, _state = model.predict(observation, deterministic=True)
            action = np.asarray(action, dtype=np.float64).reshape(action_dimension)
            assert env.book is not None and env.path is not None
            decision_prices = env.path.prices[env.path.lookback + env.day]
            decision_weights = env.book.weights(decision_prices)
            forced_decode = action.copy()
            forced_decode[0] = 1.0
            targets.append(env.decoder.decode(forced_decode, decision_weights).target_weights)
            observation, _, terminated, truncated, _ = env.step(action.astype(np.float32))
            done = bool(terminated or truncated)
        env.close()
    matrix = np.asarray(targets, dtype=np.float64)
    centroid = matrix.mean(axis=0)
    medoid_index = int(np.argmin(np.square(matrix - centroid).sum(axis=1)))
    medoid = matrix[medoid_index].copy()
    runtime.scenarios  # Keep the derivation visibly tied to the frozen validation library.
    return medoid, {
        "validation_target_count": int(len(matrix)),
        "medoid_index": medoid_index,
        "centroid_l2_distance": float(np.linalg.norm(medoid - centroid)),
        "target_weights": medoid.tolist(),
    }


def _summarize_strategies(metrics: pd.DataFrame) -> pd.DataFrame:
    return metrics.groupby("strategy", as_index=False).agg(
        episodes=("path_id", "count"),
        unique_paths=("path_id", "nunique"),
        model_seeds=("model_seed", "nunique"),
        mean_terminal_return=("terminal_return", "mean"),
        mean_excess_return=("excess_terminal_return", "mean"),
        mean_max_drawdown=("max_drawdown", "mean"),
        mean_mdd_improvement=("mdd_improvement", "mean"),
        success_rate=("success", "mean"),
        median_turnover=("total_turnover", "median"),
        median_trade_days=("trade_days", "median"),
        mean_tpp_weight=("mean_tpp_weight", "mean"),
    )


def _paired_effects(metrics: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    seeded = metrics[metrics["model_seed"] != 0].copy()
    shared = metrics[metrics["model_seed"] == 0].copy()
    wide_return = seeded.pivot(index=["model_seed", "path_id"], columns="strategy", values="terminal_return")
    wide_mdd = seeded.pivot(index=["model_seed", "path_id"], columns="strategy", values="max_drawdown")
    for strategy in ("MECHANICAL_MIN_TURNOVER_COMPLIANCE", "STATIC_DEFENSIVE_COMPLIANCE"):
        lookup_return = shared[shared["strategy"] == strategy].set_index("path_id")["terminal_return"]
        lookup_mdd = shared[shared["strategy"] == strategy].set_index("path_id")["max_drawdown"]
        wide_return[strategy] = wide_return.index.get_level_values("path_id").map(lookup_return)
        wide_mdd[strategy] = wide_mdd.index.get_level_values("path_id").map(lookup_mdd)

    effects = pd.DataFrame(index=wide_return.index)
    effects["active_timing_return"] = (
        wide_return["POLICY_ORIGINAL_REPLAY"] - wide_return["POLICY_FORCED_ONLY"]
    )
    effects["policy_target_vs_mechanical_return"] = (
        wide_return["POLICY_FORCED_ONLY"] - wide_return["MECHANICAL_MIN_TURNOVER_COMPLIANCE"]
    )
    effects["policy_target_vs_static_defensive_return"] = (
        wide_return["POLICY_FORCED_ONLY"] - wide_return["STATIC_DEFENSIVE_COMPLIANCE"]
    )
    effects["state_time_sensitivity_return"] = (
        wide_return["POLICY_FORCED_ONLY"] - wide_return["POLICY_TARGET_LAG_5D"]
    )
    effects["state_vs_validation_medoid_return"] = (
        wide_return["POLICY_FORCED_ONLY"] - wide_return["VALIDATION_POLICY_MEDOID_COMPLIANCE"]
    )
    effects["active_timing_mdd_improvement"] = (
        wide_mdd["POLICY_FORCED_ONLY"] - wide_mdd["POLICY_ORIGINAL_REPLAY"]
    )
    effects["policy_target_vs_mechanical_mdd_improvement"] = (
        wide_mdd["MECHANICAL_MIN_TURNOVER_COMPLIANCE"] - wide_mdd["POLICY_FORCED_ONLY"]
    )
    effects["policy_target_vs_static_defensive_mdd_improvement"] = (
        wide_mdd["STATIC_DEFENSIVE_COMPLIANCE"] - wide_mdd["POLICY_FORCED_ONLY"]
    )
    effects = effects.reset_index()

    rng = np.random.default_rng(20260808)
    summary: dict[str, Any] = {}
    for column in [value for value in effects.columns if value not in {"model_seed", "path_id"}]:
        pathwise = effects.groupby("path_id")[column].mean().to_numpy(float)
        summary[column] = {
            "mean": float(pathwise.mean()),
            "median": float(np.median(pathwise)),
            "path_level_95_ci": list(_confidence_interval(pathwise, rng)),
            "positive_path_fraction": float(np.mean(pathwise > 0.0)),
        }
    return effects, summary


def _action_bound_audit(steps: pd.DataFrame, action_dimension: int) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    groups = [("ALL", "ALL", steps)]
    groups.extend((str(seed), "ALL", frame) for seed, frame in steps.groupby("model_seed"))
    groups.extend(("ALL", str(family), frame) for family, frame in steps.groupby("family"))
    for seed, family, frame in groups:
        matrix = np.stack([np.asarray(value, dtype=np.float64) for value in frame["raw_action"]])
        for dimension in range(action_dimension):
            rows.append(
                {
                    "model_seed": seed,
                    "family": family,
                    "action_dimension": dimension,
                    "samples": int(len(matrix)),
                    "bound_hit_fraction": float(np.mean(np.abs(matrix[:, dimension]) >= 0.999)),
                    "mean": float(matrix[:, dimension].mean()),
                    "std": float(matrix[:, dimension].std(ddof=0)),
                    "min": float(matrix[:, dimension].min()),
                    "max": float(matrix[:, dimension].max()),
                }
            )
    return pd.DataFrame(rows)


def _rule_trigger_audit(steps: pd.DataFrame) -> pd.DataFrame:
    triggered = steps[~steps["pre_trade_legal"].astype(bool)].copy()
    rows: list[dict[str, Any]] = []
    for _, row in triggered.iterrows():
        violations = row["pre_trade_violations"] or ["UNKNOWN"]
        for violation in violations:
            rows.append(
                {
                    "model_seed": int(row["model_seed"]),
                    "path_id": str(row["path_id"]),
                    "family": str(row["family"]),
                    "scenario_day": int(row["scenario_day"]),
                    "final_session": bool(row["final_session"]),
                    "action_status": str(row["action_status"]),
                    "violation": str(violation),
                    "pre_trade_heavy_headroom_strict": float(row["pre_trade_heavy_headroom_strict"]),
                    "pre_trade_tpp_min_headroom": float(row["pre_trade_tpp_min_headroom"]),
                    "pre_trade_tpp_max_headroom": float(row["pre_trade_tpp_max_headroom"]),
                    "pre_trade_stock_min_headroom": float(row["pre_trade_stock_min_headroom"]),
                    "pre_trade_stock_max_headroom": float(row["pre_trade_stock_max_headroom"]),
                    "turnover": float(row["turnover"]),
                    "commission": float(row["commission"]),
                }
            )
    return pd.DataFrame(rows)


def _source_replay_comparison(source: pd.DataFrame, replay: pd.DataFrame) -> dict[str, Any]:
    keys = ["model_seed", "path_id", "scenario_day"]
    columns = keys + ["nav", "passive_nav", "turnover", "commission", "action_status"]
    merged = source[columns].merge(replay[columns], on=keys, suffixes=("_source", "_replay"), validate="one_to_one")
    result: dict[str, Any] = {"rows": int(len(merged))}
    for column in ("nav", "passive_nav", "turnover", "commission"):
        result[f"max_abs_{column}_difference"] = float(
            np.max(np.abs(merged[f"{column}_source"] - merged[f"{column}_replay"]))
        )
    result["action_status_match_fraction"] = float(
        np.mean(merged["action_status_source"] == merged["action_status_replay"])
    )
    result["byte_equivalent_numeric_replay"] = bool(
        all(result[f"max_abs_{column}_difference"] <= 1e-9 for column in ("nav", "passive_nav", "turnover", "commission"))
        and result["action_status_match_fraction"] == 1.0
    )
    return result


def _execution_timing_audit(original_steps: pd.DataFrame) -> dict[str, Any]:
    forced = original_steps[~original_steps["pre_trade_legal"].astype(bool)]
    finals = original_steps[original_steps["final_session"].astype(bool)]
    final_executed = finals[finals["turnover"] > 1e-12]
    same_close = forced[
        forced["compliance_check_price_index"].astype(int)
        == forced["execution_price_index"].astype(int)
    ]
    return {
        "episodes": int(len(finals)),
        "forced_trigger_days": int(len(forced)),
        "forced_trigger_same_close_days": int(len(same_close)),
        "forced_trigger_same_close_fraction": float(len(same_close) / max(len(forced), 1)),
        "terminal_hold_days": int((finals["action_status"] == "TERMINAL_HOLD").sum()),
        "final_session_executed_trade_days": int(len(final_executed)),
        "final_session_commission_try": float(final_executed["commission"].sum()),
        "same_close_compliance_trigger_risk": bool(len(same_close) > 0),
        "contract_assessment": (
            "FAIL: compliance is detected from t close weights and the repair is executed at the same t close"
            if len(same_close) > 0
            else "PASS: no same-close compliance trigger observed"
        ),
    }


def _render_report(
    output: Path,
    strategy_summary: pd.DataFrame,
    effects: dict[str, Any],
    timing: dict[str, Any],
    replay: dict[str, Any],
    medoids: dict[str, Any],
) -> None:
    lookup = strategy_summary.set_index("strategy")
    def value(strategy: str, column: str) -> float:
        return float(lookup.loc[strategy, column])

    report = f"""# PPO V2 P0 Counterfactual ve Zamanlama Denetimi

## Kapsam

Bu çalışma mevcut checkpointleri değiştirmeden, re-locked test yollarını yalnız tanısal/regresyon amaçlı yeniden oynatır. Yeni model seçimi veya hiperparametre ayarı yapılmamıştır.

## Ana sonuçlar

- Orijinal replay ortalama terminal getiri: `{value('POLICY_ORIGINAL_REPLAY', 'mean_terminal_return'):.4%}`.
- Gönüllü işlemler kapalı POLICY_FORCED_ONLY: `{value('POLICY_FORCED_ONLY', 'mean_terminal_return'):.4%}`.
- Minimum-turnover mekanik compliance: `{value('MECHANICAL_MIN_TURNOVER_COMPLIANCE', 'mean_terminal_return'):.4%}`.
- Sabit train-only defensive compliance: `{value('STATIC_DEFENSIVE_COMPLIANCE', 'mean_terminal_return'):.4%}`.
- Beş gün geciktirilmiş policy target: `{value('POLICY_TARGET_LAG_5D', 'mean_terminal_return'):.4%}`.
- Validation medoid target: `{value('VALIDATION_POLICY_MEDOID_COMPLIANCE', 'mean_terminal_return'):.4%}`.

## Ayrıştırılmış katkılar

- Gönüllü aktif zamanlama katkısı: `{effects['active_timing_return']['mean']:.4%}` (path-level %95 GA `{effects['active_timing_return']['path_level_95_ci'][0]:.4%}`, `{effects['active_timing_return']['path_level_95_ci'][1]:.4%}`).
- PPO target seçimi eksi mekanik minimum-turnover repair: `{effects['policy_target_vs_mechanical_return']['mean']:.4%}`.
- PPO target seçimi eksi sabit defensive compliance: `{effects['policy_target_vs_static_defensive_return']['mean']:.4%}`.
- Orijinal target zamanlaması eksi 5-gün gecikmeli target: `{effects['state_time_sensitivity_return']['mean']:.4%}`.
- Orijinal state-dependent target eksi validation medoid target: `{effects['state_vs_validation_medoid_return']['mean']:.4%}`.

## Execution sözleşmesi

- Forced trigger günleri: `{timing['forced_trigger_days']}`.
- Aynı kapanıştan kural tespiti ve execution: `{timing['forced_trigger_same_close_days']}`.
- Final gün işlem sayısı: `{timing['final_session_executed_trade_days']}`.
- Karar: `{timing['contract_assessment']}`.

Bu bulgu mevcut V2 testinin sayısal replay değerlerini bozmaz; ancak `t-1 bilgi -> t MOC` nedensellik iddiasını forced-rebalance kanalı için geçersiz kılar. Zamanlama düzeltilirse yeni V2.1 eğitimi ve yeni kilitli test gerekir.

## Yeniden üretilebilirlik

- Kaynak replay satırı: `{replay['rows']}`.
- Maksimum NAV farkı: `{replay['max_abs_nav_difference']:.12g}`.
- Status eşleşmesi: `{replay['action_status_match_fraction']:.2%}`.
- Sayısal replay sözleşmesi: `{'PASS' if replay['byte_equivalent_numeric_replay'] else 'FAIL'}`.
- Validation medoidleri üç model seed’i için ayrı ve yalnız validation yollarından türetilmiştir: `{', '.join(sorted(medoids))}`.

## Yorumlama sınırı

Bu çıktı, PPO’nun aktif zamanlama ve target-selection katkısını mekanik compliance etkisinden ayırır. Aynı re-locked test artık geliştirme kararında kullanılmış olduğundan, herhangi bir mimari/reward/timing değişikliği için bağımsız başarı kanıtı sayılamaz.
"""
    (output / "P0_COUNTERFACTUAL_RAPORU.md").write_text(report, encoding="utf-8")


def run_counterfactual_audit(
    config_path: str,
    source_evaluation: str,
    *,
    output_name: str | None = None,
    max_paths: int | None = None,
) -> Path:
    runtime = build_runtime(config_path)
    config = runtime.config
    source = Path(source_evaluation).resolve()
    source_steps = pd.read_parquet(source / "step_log.parquet")
    source_manifest = json.loads((source / "evaluation_manifest.json").read_text(encoding="utf-8"))
    paths = runtime.scenarios.frozen_paths("test")
    if max_paths is not None:
        paths = paths[: int(max_paths)]
    path_lookup = {_path_id(path): path for path in paths}
    actions = _stored_action_map(source_steps[source_steps["path_id"].isin(path_lookup)])
    output_name = output_name or f"p0_counterfactual_{datetime.now():%Y%m%d_%H%M%S}"
    output = Path(config["paths"]["report_root"]) / output_name
    output.mkdir(parents=True, exist_ok=False)

    selected_models = source_manifest["selected_models"]
    model_files = [Path(item["model_path"]).resolve() for item in selected_models]
    defensive = _baseline_targets(runtime)["TRAIN_ONLY_DEFENSIVE_DOWNSIDE_BETA"]
    neutral_provider = _constant_provider(int(config["action"]["raw_dimension"]))

    metric_rows: list[dict[str, Any]] = []
    original_daily: list[pd.DataFrame] = []
    example_daily: list[pd.DataFrame] = []
    medoid_manifest: dict[str, Any] = {}
    replay_hashes: list[dict[str, Any]] = []

    # Shared policy-independent counterfactuals are evaluated once per path.
    for path_index, path in enumerate(paths, start=1):
        for strategy, execution_policy, target in (
            ("MECHANICAL_MIN_TURNOVER_COMPLIANCE", "MECHANICAL_MIN_TURNOVER_COMPLIANCE", None),
            ("STATIC_DEFENSIVE_COMPLIANCE", "STATIC_TARGET_COMPLIANCE", defensive),
        ):
            metrics, daily = _run_episode(
                runtime,
                path,
                0,
                strategy,
                execution_policy=execution_policy,
                action_provider=neutral_provider,
                compliance_target=target,
            )
            metric_rows.append(metrics)
            if path_index == 1:
                example_daily.append(daily)

    for selected in selected_models:
        seed = int(selected["model_seed"])
        model = PPO.load(selected["model_path"], device=config["ppo"]["device"])
        medoid, medoid_metadata = _validation_policy_medoid(model, runtime)
        medoid_manifest[str(seed)] = medoid_metadata
        online = _online_provider(model)

        for path_index, path in enumerate(paths, start=1):
            key = (seed, _path_id(path))
            if key not in actions:
                raise KeyError(f"Source action sequence missing: {key}")
            sequence = actions[key]
            strategies = (
                ("POLICY_ORIGINAL_REPLAY", "POLICY_ORIGINAL", _sequence_provider(sequence), None),
                ("POLICY_FORCED_ONLY", "POLICY_FORCED_ONLY", online, None),
                ("POLICY_TARGET_LAG_5D", "POLICY_FORCED_ONLY", _sequence_provider(sequence, lag=5), None),
                ("VALIDATION_POLICY_MEDOID_COMPLIANCE", "STATIC_TARGET_COMPLIANCE", neutral_provider, medoid),
            )
            for strategy, execution_policy, provider, target in strategies:
                metrics, daily = _run_episode(
                    runtime,
                    path,
                    seed,
                    strategy,
                    execution_policy=execution_policy,
                    action_provider=provider,
                    compliance_target=target,
                )
                metric_rows.append(metrics)
                if strategy == "POLICY_ORIGINAL_REPLAY":
                    original_daily.append(daily)
                if path_index == 1:
                    example_daily.append(daily)

            if path_index == 1:
                first_metrics, first_trace = _run_episode(
                    runtime,
                    path,
                    seed,
                    "DETERMINISTIC_REPLAY_A",
                    execution_policy="POLICY_ORIGINAL",
                    action_provider=online,
                )
                second_metrics, second_trace = _run_episode(
                    runtime,
                    path,
                    seed,
                    "DETERMINISTIC_REPLAY_B",
                    execution_policy="POLICY_ORIGINAL",
                    action_provider=online,
                )
                symbols = list(config["universe"]["tickers"]) + [config["universe"]["tpp_symbol"]]
                first_hash = hash_daily_trace(first_trace, symbols)
                second_hash = hash_daily_trace(second_trace, symbols)
                replay_hashes.append(
                    {
                        "model_seed": seed,
                        "path_id": _path_id(path),
                        "first_trace_sha256": first_hash,
                        "second_trace_sha256": second_hash,
                        "identical": first_hash == second_hash,
                        "terminal_nav_difference": float(
                            first_metrics["terminal_nav"] - second_metrics["terminal_nav"]
                        ),
                    }
                )
            if path_index % 16 == 0:
                print(f"COUNTERFACTUAL_PROGRESS seed={seed} {path_index}/{len(paths)}", flush=True)

    metrics = pd.DataFrame(metric_rows)
    originals = pd.concat(original_daily, ignore_index=True)
    examples = pd.concat(example_daily, ignore_index=True)
    strategy_summary = _summarize_strategies(metrics)
    paired, effect_summary = _paired_effects(metrics)
    action_bounds = _action_bound_audit(
        source_steps[source_steps["path_id"].isin(path_lookup)],
        int(config["action"]["raw_dimension"]),
    )
    rule_triggers = _rule_trigger_audit(originals)
    replay_comparison = _source_replay_comparison(
        source_steps[source_steps["path_id"].isin(path_lookup)], originals
    )
    timing_audit = _execution_timing_audit(originals)
    full_blotter = _trade_blotter(
        originals,
        list(config["universe"]["tickers"]) + [str(config["universe"]["tpp_symbol"])],
    )

    metrics.to_parquet(output / "counterfactual_metrics.parquet", index=False)
    metrics.to_csv(output / "counterfactual_metrics.csv", index=False)
    originals.to_parquet(output / "original_replay_step_log.parquet", index=False)
    examples.to_csv(output / "counterfactual_example_daily.csv", index=False)
    full_blotter.to_parquet(output / "full_daily_trade_blotter.parquet", index=False)
    strategy_summary.to_csv(output / "counterfactual_strategy_summary.csv", index=False)
    paired.to_csv(output / "paired_counterfactual_effects.csv", index=False)
    action_bounds.to_csv(output / "action_bound_by_dimension.csv", index=False)
    rule_triggers.to_csv(output / "rule_trigger_audit.csv", index=False)
    (output / "counterfactual_effect_summary.json").write_text(
        json.dumps(effect_summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (output / "execution_timing_audit.json").write_text(
        json.dumps(timing_audit, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (output / "source_replay_comparison.json").write_text(
        json.dumps(replay_comparison, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (output / "validation_policy_medoids.json").write_text(
        json.dumps(medoid_manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (output / "deterministic_replay_hashes.json").write_text(
        json.dumps(replay_hashes, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    _render_report(output, strategy_summary, effect_summary, timing_audit, replay_comparison, medoid_manifest)
    manifest_files = [
        Path(config_path).resolve(),
        Path(__file__).resolve(),
        Path(__file__).with_name("env.py").resolve(),
        Path(__file__).with_name("decoder.py").resolve(),
        Path(__file__).with_name("constraints.py").resolve(),
        Path(__file__).with_name("portfolio.py").resolve(),
        Path(__file__).with_name("scenarios.py").resolve(),
        source / "evaluation_manifest.json",
        source / "evaluation_summary.json",
        *model_files,
    ]
    write_hash_manifest(
        output / "reproducibility_manifest.json",
        files=manifest_files,
        paths=paths,
        metadata={
            "generated_at": datetime.now().isoformat(timespec="seconds"),
            "source_evaluation": str(source),
            "source_evaluation_manifest_sha256": sha256_file(source / "evaluation_manifest.json"),
            "test_tuning_allowed": False,
            "purpose": "diagnostic_counterfactual_and_regression_only",
            "max_paths": max_paths,
        },
    )
    output_files = [path for path in output.iterdir() if path.is_file() and path.name != "output_hashes.json"]
    (output / "output_hashes.json").write_text(
        json.dumps(
            {
                path.name: {"bytes": path.stat().st_size, "sha256": sha256_file(path)}
                for path in sorted(output_files)
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(json.dumps({"output": str(output), "timing": timing_audit, "replay": replay_comparison}, indent=2))
    print(f"COUNTERFACTUAL_COMPLETE {output}", flush=True)
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--source-evaluation", required=True)
    parser.add_argument("--output-name")
    parser.add_argument("--max-paths", type=int)
    args = parser.parse_args()
    run_counterfactual_audit(
        args.config,
        args.source_evaluation,
        output_name=args.output_name,
        max_paths=args.max_paths,
    )


if __name__ == "__main__":
    main()
