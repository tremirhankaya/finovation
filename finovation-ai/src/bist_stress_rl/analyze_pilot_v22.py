from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from .config import load_config


MODELS = ["P0_SCENARIO_BLIND", "P1_SCENARIO_CONDITIONED", "P2_EVENT_ORACLE"]
DEPLOYABLE = ["P0_SCENARIO_BLIND", "P1_SCENARIO_CONDITIONED"]


def _load_completed(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("status") != "complete":
        raise RuntimeError(f"Coordinator is not complete: {path}")
    return payload["completed"]


def _quality_gates(validation_jobs: list[dict]) -> tuple[dict, pd.DataFrame, pd.DataFrame]:
    all_metrics = []
    all_daily = []
    per_run = []
    path_reference: list[tuple[str, str, int]] | None = None
    symbols = list(load_config(validation_jobs[0]["config"])["universe"]["tickers"]) + ["TPP_ON"]
    equity_symbols = symbols[:-1]
    for job in validation_jobs:
        output = Path(job["output_dir"])
        metrics = pd.read_parquet(output / "episode_summary.parquet")
        daily = pd.read_parquet(output / "daily_portfolio.parquet")
        metrics["run_name"] = job["run_name"]
        daily["run_name"] = job["run_name"]
        all_metrics.append(metrics)
        all_daily.append(daily)
        path_signature = sorted(
            (str(row.path_id), str(row.family), int(row.days))
            for row in metrics[["path_id", "family", "days"]].itertuples(index=False)
        )
        if path_reference is None:
            path_reference = path_signature
        weight_error = np.max(
            np.abs(daily[[f"weight_{symbol}" for symbol in symbols]].sum(axis=1).to_numpy() - 1.0)
        )
        target_error = np.max(
            np.abs(daily[[f"target_weight_{symbol}" for symbol in symbols]].sum(axis=1).to_numpy() - 1.0)
        )
        passive_error = np.max(
            np.abs(daily[[f"passive_weight_{symbol}" for symbol in symbols]].sum(axis=1).to_numpy() - 1.0)
        )
        reward_sum = daily[
            ["reward_relative", "reward_mdd_absolute", "reward_mdd_relative", "reward_target_change"]
        ].sum(axis=1)
        reward_error = float(np.max(np.abs(daily["reward"].to_numpy() - reward_sum.to_numpy())))
        passive_unit_drift = 0.0
        for (_, path_daily) in daily.groupby(["path_id"]):
            for symbol in equity_symbols:
                proxy_units = (
                    path_daily[f"passive_weight_{symbol}"].to_numpy(dtype=float)
                    * path_daily["passive_nav"].to_numpy(dtype=float)
                    / path_daily[f"price_t_{symbol}"].to_numpy(dtype=float)
                )
                passive_unit_drift = max(
                    passive_unit_drift,
                    float(np.ptp(proxy_units) / max(abs(float(np.mean(proxy_units))), 1e-12)),
                )
        target_values = daily[[f"target_weight_{symbol}" for symbol in symbols]].to_numpy(dtype=float)
        fractional_evidence = bool(np.any(np.abs(target_values * 100.0 - np.round(target_values * 100.0)) > 1e-5))
        finite = bool(np.isfinite(daily.select_dtypes(include=[np.number]).to_numpy()).all())
        per_run.append(
            {
                "model_id": job["model_id"],
                "model_seed": int(job["seed"]),
                "paths": int(len(metrics)),
                "same_path_signature": path_signature == path_reference,
                "illegal_days": int(metrics["illegal_days"].sum()),
                "max_weight_sum_error": float(weight_error),
                "max_target_sum_error": float(target_error),
                "max_passive_sum_error": float(passive_error),
                "max_reward_recomposition_error": reward_error,
                "max_passive_equity_unit_relative_drift": passive_unit_drift,
                "fractional_target_evidence": fractional_evidence,
                "all_numeric_finite": finite,
            }
        )
    gates = pd.DataFrame(per_run)
    checks = {
        "six_runs_present": len(gates) == 6,
        "all_use_identical_paths": bool(gates["same_path_signature"].all()),
        "all_have_64_paths": bool((gates["paths"] == 64).all()),
        "zero_agent_illegal_days": int(gates["illegal_days"].sum()) == 0,
        "weight_sums_within_1e_8": float(gates["max_weight_sum_error"].max()) <= 1e-8,
        "target_sums_within_1e_8": float(gates["max_target_sum_error"].max()) <= 1e-8,
        "passive_sums_within_1e_8": float(gates["max_passive_sum_error"].max()) <= 1e-8,
        "reward_recomposes_within_1e_10": float(gates["max_reward_recomposition_error"].max()) <= 1e-10,
        "passive_equity_units_fixed_within_1e_8": float(gates["max_passive_equity_unit_relative_drift"].max()) <= 1e-8,
        "fractional_targets_observed": bool(gates["fractional_target_evidence"].all()),
        "all_numeric_values_finite": bool(gates["all_numeric_finite"].all()),
    }
    checks["all_mandatory_gates_pass"] = bool(all(checks.values()))
    return checks, pd.concat(all_metrics, ignore_index=True), pd.concat(all_daily, ignore_index=True)


def _episode_metrics(episodes: pd.DataFrame) -> pd.DataFrame:
    frame = episodes.copy()
    frame["return_success"] = frame["excess_terminal_return"] > 0.0
    frame["mdd_success"] = frame["mdd_improvement"] > 0.0
    frame["dual_success"] = frame["return_success"] & frame["mdd_success"]
    return frame


def _aggregate(episodes: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    aggregations = {
        "episodes": ("path_id", "count"),
        "mean_terminal_return": ("terminal_return", "mean"),
        "mean_passive_return": ("passive_terminal_return", "mean"),
        "mean_excess_return": ("excess_terminal_return", "mean"),
        "median_excess_return": ("excess_terminal_return", "median"),
        "std_excess_return": ("excess_terminal_return", "std"),
        "mean_mdd": ("max_drawdown", "mean"),
        "mean_passive_mdd": ("passive_max_drawdown", "mean"),
        "mean_mdd_improvement": ("mdd_improvement", "mean"),
        "return_success_rate": ("return_success", "mean"),
        "mdd_success_rate": ("mdd_success", "mean"),
        "dual_success_rate": ("dual_success", "mean"),
        "median_realized_turnover": ("realized_turnover", "median"),
        "mean_commission_try": ("total_commission_try", "mean"),
        "mean_total_reward": ("total_reward", "mean"),
        "illegal_days": ("illegal_days", "sum"),
    }
    by_family = (
        episodes.groupby(["model_id", "model_seed", "family"], as_index=False)
        .agg(**aggregations)
        .sort_values(["model_id", "model_seed", "family"])
    )
    overall = (
        episodes.groupby(["model_id", "model_seed"], as_index=False)
        .agg(**aggregations)
        .sort_values(["model_id", "model_seed"])
    )
    return by_family, overall


def _learning_curves(validation_jobs: list[dict]) -> pd.DataFrame:
    rows = []
    for job in validation_jobs:
        npz = Path(job["run_dir"]) / "eval_logs" / "evaluations.npz"
        if not npz.exists():
            continue
        payload = np.load(npz)
        for index, timestep in enumerate(payload["timesteps"]):
            rewards = payload["results"][index]
            rows.append(
                {
                    "model_id": job["model_id"],
                    "model_seed": int(job["seed"]),
                    "timestep": int(timestep),
                    "mean_eval_reward": float(np.mean(rewards)),
                    "std_eval_reward": float(np.std(rewards)),
                    "episodes": int(len(rewards)),
                }
            )
    return pd.DataFrame(rows)


def _selection(overall: pd.DataFrame, gates: dict) -> dict:
    deployable = overall[overall["model_id"].isin(DEPLOYABLE)].copy()
    deployable["seed_utility"] = deployable["mean_excess_return"] + 0.5 * deployable["mean_mdd_improvement"]
    candidates = (
        deployable.groupby("model_id", as_index=False)
        .agg(
            robust_utility=("seed_utility", "median"),
            worst_seed_utility=("seed_utility", "min"),
            mean_excess_return=("mean_excess_return", "mean"),
            mean_mdd_improvement=("mean_mdd_improvement", "mean"),
            dual_success_rate=("dual_success_rate", "mean"),
            median_turnover=("median_realized_turnover", "median"),
            seed_excess_dispersion=("mean_excess_return", "std"),
        )
        .sort_values(
            ["robust_utility", "worst_seed_utility", "dual_success_rate", "median_turnover"],
            ascending=[False, False, False, True],
        )
    )
    selected = str(candidates.iloc[0]["model_id"])
    top = candidates.iloc[0]
    poor = bool(float(top["mean_excess_return"]) <= 0.0 or float(top["dual_success_rate"]) < 0.50)
    return {
        "selected_deployable_model_type": selected,
        "technical_gates_pass": bool(gates["all_mandatory_gates_pass"]),
        "pilot_performance_below_desired_gate": poor,
        "selection_rule": "highest median seed utility = mean excess return + 0.5 * mean MDD improvement; ties use worst seed, dual success, then lower turnover",
        "candidate_table": candidates.to_dict(orient="records"),
        "p2_status": "research_upper_bound_only_never_auto_deploy",
    }


def _historical(historical_jobs: list[dict]) -> tuple[pd.DataFrame, pd.DataFrame]:
    frames = []
    for job in historical_jobs:
        frame = pd.read_parquet(Path(job["output_dir"]) / "episode_summary.parquet")
        frame["run_name"] = job["run_name"]
        frames.append(frame)
    episodes = _episode_metrics(pd.concat(frames, ignore_index=True))
    by_model = (
        episodes.groupby(["model_id", "model_seed", "family"], as_index=False)
        .agg(
            terminal_nav_try=("terminal_nav_try", "mean"),
            passive_terminal_nav_try=("passive_terminal_nav_try", "mean"),
            excess_terminal_return=("excess_terminal_return", "mean"),
            max_drawdown=("max_drawdown", "mean"),
            passive_max_drawdown=("passive_max_drawdown", "mean"),
            mdd_improvement=("mdd_improvement", "mean"),
            realized_turnover=("realized_turnover", "mean"),
            total_commission_try=("total_commission_try", "mean"),
            total_reward=("total_reward", "mean"),
        )
    )
    return episodes, by_model


def _plots(output: Path, overall: pd.DataFrame, by_family: pd.DataFrame, learning: pd.DataFrame, historical: pd.DataFrame) -> None:
    plot_dir = output / "plots"
    plot_dir.mkdir(exist_ok=True)
    labels = overall["model_id"] + "\n" + overall["model_seed"].astype(str)
    for column, title, name in [
        ("mean_excess_return", "Pilot Validation: Ortalama Excess Return", "pilot_excess_return.png"),
        ("mean_mdd_improvement", "Pilot Validation: MDD İyileşmesi", "pilot_mdd_improvement.png"),
        ("dual_success_rate", "Pilot Validation: Çift Başarı Oranı", "pilot_dual_success.png"),
        ("median_realized_turnover", "Pilot Validation: Medyan Turnover", "pilot_turnover.png"),
    ]:
        fig, ax = plt.subplots(figsize=(11, 5))
        ax.bar(labels, overall[column])
        ax.axhline(0.0, color="black", linewidth=0.8)
        ax.set_title(title)
        ax.tick_params(axis="x", rotation=30)
        ax.grid(axis="y", alpha=0.25)
        fig.tight_layout()
        fig.savefig(plot_dir / name, dpi=160)
        plt.close(fig)
    if not learning.empty:
        fig, ax = plt.subplots(figsize=(10, 5))
        for (model, seed), group in learning.groupby(["model_id", "model_seed"]):
            ax.plot(group["timestep"], group["mean_eval_reward"], marker="o", label=f"{model} {seed}")
        ax.set_title("Checkpoint Validation Reward Eğrisi")
        ax.set_xlabel("Step")
        ax.set_ylabel("Ortalama episode reward")
        ax.legend(fontsize=7)
        ax.grid(alpha=0.25)
        fig.tight_layout()
        fig.savefig(plot_dir / "checkpoint_learning_curves.png", dpi=160)
        plt.close(fig)
    if not historical.empty:
        pivot = historical.pivot_table(index=["model_id", "model_seed"], columns="family", values="excess_terminal_return")
        fig, ax = plt.subplots(figsize=(10, 5))
        pivot.plot(kind="bar", ax=ax)
        ax.axhline(0.0, color="black", linewidth=0.8)
        ax.set_title("Gerçek Tarih Replay: Pasife Göre Excess Return")
        ax.grid(axis="y", alpha=0.25)
        fig.tight_layout()
        fig.savefig(plot_dir / "historical_excess_return.png", dpi=160)
        plt.close(fig)


def analyze() -> Path:
    root = Path.cwd().resolve()
    pipeline = root / "artifacts_v22" / "pipeline"
    validation_jobs = _load_completed(pipeline / "evaluation_coordinator_validation.json")
    historical_jobs = _load_completed(pipeline / "historical_coordinator.json")
    output = pipeline / "pilot_analysis"
    output.mkdir(parents=True, exist_ok=True)
    gates, episodes, daily = _quality_gates(validation_jobs)
    episodes = _episode_metrics(episodes)
    by_family, overall = _aggregate(episodes)
    learning = _learning_curves(validation_jobs)
    selection = _selection(overall, gates)
    historical_episodes, historical_model = _historical(historical_jobs)
    episodes.to_parquet(output / "validation_all_episodes.parquet", index=False)
    episodes.to_csv(output / "validation_all_episodes.csv", index=False)
    daily.to_parquet(output / "validation_all_daily.parquet", index=False)
    by_family.to_csv(output / "validation_metrics_by_family_seed.csv", index=False)
    overall.to_csv(output / "validation_metrics_overall_seed.csv", index=False)
    learning.to_csv(output / "checkpoint_learning_curves.csv", index=False)
    historical_episodes.to_csv(output / "historical_all_episodes.csv", index=False)
    historical_model.to_csv(output / "historical_metrics_by_model_seed.csv", index=False)
    (output / "quality_gates.json").write_text(json.dumps(gates, indent=2, ensure_ascii=False), encoding="utf-8")
    (output / "provisional_selection.json").write_text(json.dumps(selection, indent=2, ensure_ascii=False), encoding="utf-8")
    _plots(output, overall, by_family, learning, historical_model)
    report = [
        "# V2.2 Pilot Analizi",
        "",
        f"Üretim zamanı: {datetime.now().isoformat(timespec='seconds')}",
        "",
        f"Teknik kapılar: {'GEÇTİ' if gates['all_mandatory_gates_pass'] else 'KALDI'}",
        f"Geçici uygulanabilir model seçimi: {selection['selected_deployable_model_type']}",
        f"Performans kapısı: {'ZAYIF - kontrollü ek deney önerilir' if selection['pilot_performance_below_desired_gate'] else 'YETERLİ'}",
        "",
        "P2 yalnızca araştırma üst sınırıdır. Gerçek olay replay sonuçları kalibrasyon tanısıdır ve bağımsız test sayılmaz.",
        "",
        "Ayrıntılı tablolar ve grafikler bu klasördedir.",
    ]
    (output / "PILOT_ANALYSIS.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    with (pipeline / "execution_log.jsonl").open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"timestamp": datetime.now().isoformat(timespec="seconds"), "event": "pilot_analysis_complete", "output": str(output.resolve()), "selected": selection["selected_deployable_model_type"], "gates_pass": gates["all_mandatory_gates_pass"]}, ensure_ascii=False) + "\n")
    print(json.dumps(selection, indent=2, ensure_ascii=False))
    return output


if __name__ == "__main__":
    analyze()
