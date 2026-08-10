from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


SEEDS = [42, 31415, 271828]
FAMILIES = ["S1", "S2"]


def _load_manifest(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _assert_same_contract(old_dir: Path, new_dir: Path) -> dict:
    old = _load_manifest(old_dir / "inference_manifest.json")
    new = _load_manifest(new_dir / "inference_manifest.json")
    checks = {
        "initial_nav_equal": old["initial_nav_try"] == new["initial_nav_try"],
        "initial_weights_equal": old["initial_weights"] == new["initial_weights"],
        "families_equal": old["families"] == new["families"],
        "input_hashes_equal": {
            key: old["input_data"][key]["sha256"] == new["input_data"][key]["sha256"]
            for key in old["input_data"]
        },
    }
    if not checks["initial_nav_equal"]:
        raise ValueError("Initial NAV differs")
    if not checks["initial_weights_equal"]:
        raise ValueError("Initial weights differ")
    if not checks["families_equal"]:
        raise ValueError("Scenario intervals differ")
    if not all(checks["input_hashes_equal"].values()):
        raise ValueError("Input data hashes differ")
    return checks


def _save(fig: plt.Figure, path: Path) -> None:
    fig.tight_layout()
    fig.savefig(path, dpi=190, bbox_inches="tight")
    plt.close(fig)


def build(root: Path | None = None) -> Path:
    root = (root or Path.cwd()).resolve()
    old_root = root / "artifacts_v22" / "inference_runs" / "requested_weights_20260809"
    new_root = root / "artifacts_v22d" / "final_delivery" / "historical_replay"
    output = root / "artifacts_v22d" / "generation_comparison_20260809"
    plots = output / "plots"
    plots.mkdir(parents=True, exist_ok=True)

    summary_frames = []
    daily_frames = []
    weight_frames = []
    contract_checks = {}
    for seed in SEEDS:
        old_dir = old_root / f"seed_{seed}"
        new_dir = new_root / f"seed{seed}"
        contract_checks[str(seed)] = _assert_same_contract(old_dir, new_dir)
        for generation, directory in [("V2.2 eski", old_dir), ("V2.2d yeni", new_dir)]:
            summary = pd.read_csv(directory / "scenario_summary.csv")
            summary.insert(0, "generation", generation)
            summary_frames.append(summary)
            daily = pd.read_csv(directory / "daily_overview.csv")
            daily.insert(0, "generation", generation)
            daily_frames.append(daily)
            weights = pd.read_csv(directory / "daily_weights_long.csv")
            weights.insert(0, "generation", generation)
            weight_frames.append(weights)

    summary = pd.concat(summary_frames, ignore_index=True)
    daily = pd.concat(daily_frames, ignore_index=True)
    weights = pd.concat(weight_frames, ignore_index=True)
    old = summary[summary["generation"] == "V2.2 eski"]
    new = summary[summary["generation"] == "V2.2d yeni"]
    paired = old.merge(
        new,
        on=["model_seed", "family"],
        suffixes=("_old", "_new"),
        validate="one_to_one",
    )
    paired["terminal_return_delta"] = paired["terminal_return_new"] - paired["terminal_return_old"]
    paired["excess_delta"] = paired["excess_terminal_return_new"] - paired["excess_terminal_return_old"]
    paired["mdd_delta"] = paired["max_drawdown_old"] - paired["max_drawdown_new"]
    paired["commission_delta_try"] = paired["total_commission_try_new"] - paired["total_commission_try_old"]
    paired["turnover_delta"] = paired["realized_turnover_new"] - paired["realized_turnover_old"]

    metrics = [
        "terminal_return",
        "excess_terminal_return",
        "max_drawdown",
        "mdd_improvement",
        "realized_turnover",
        "total_commission_try",
        "target_update_days",
        "trade_days",
        "illegal_days",
    ]
    aggregate = summary.groupby(["generation", "family"])[metrics].agg(["mean", "std", "min", "max"])
    aggregate.columns = ["_".join(column) for column in aggregate.columns]
    aggregate = aggregate.reset_index()

    summary.to_csv(output / "all_model_scenario_results.csv", index=False)
    paired.to_csv(output / "paired_seed_deltas.csv", index=False)
    aggregate.to_csv(output / "aggregate_comparison.csv", index=False)
    daily.to_csv(output / "daily_nav_all_models.csv", index=False)
    weights.to_csv(output / "daily_weights_all_models.csv", index=False)

    colors = {"V2.2 eski": "#6b7280", "V2.2d yeni": "#2563eb"}
    for family in FAMILIES:
        fig, ax = plt.subplots(figsize=(12, 5.5))
        frame = daily[daily["family"] == family]
        for generation in ["V2.2 eski", "V2.2d yeni"]:
            gen = frame[frame["generation"] == generation]
            matrix = gen.pivot(index="execution_date", columns="model_seed", values="nav").astype(float)
            dates = pd.to_datetime(matrix.index)
            mean = matrix.mean(axis=1)
            ax.plot(dates, mean, label=f"{generation} seed ortalaması", color=colors[generation], linewidth=2.3)
            ax.fill_between(dates, matrix.min(axis=1), matrix.max(axis=1), color=colors[generation], alpha=0.14)
        passive = frame[frame["model_seed"] == SEEDS[0]].drop_duplicates("execution_date")
        ax.plot(pd.to_datetime(passive["execution_date"]), passive["passive_nav"], label="Pasif fon", color="black", linestyle="--", linewidth=2)
        ax.set_title(f"{family}: Eski ve yeni model günlük NAV")
        ax.set_ylabel("TL")
        ax.grid(alpha=0.25)
        ax.legend()
        fig.autofmt_xdate()
        _save(fig, plots / f"{family.lower()}_nav_old_vs_new.png")

    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))
    for ax, family in zip(axes, FAMILIES):
        frame = summary[summary["family"] == family]
        x = np.arange(len(SEEDS))
        width = 0.34
        for offset, generation in [(-width / 2, "V2.2 eski"), (width / 2, "V2.2d yeni")]:
            values = frame[frame["generation"] == generation].set_index("model_seed").loc[SEEDS, "excess_terminal_return"] * 100
            ax.bar(x + offset, values, width, label=generation, color=colors[generation])
        ax.set_xticks(x, [str(seed) for seed in SEEDS])
        ax.set_title(f"{family}: Pasife göre excess")
        ax.set_xlabel("Seed")
        ax.set_ylabel("Yüzde puan")
        ax.grid(axis="y", alpha=0.25)
    axes[0].legend()
    _save(fig, plots / "excess_return_by_seed.png")

    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))
    for ax, family in zip(axes, FAMILIES):
        frame = summary[summary["family"] == family]
        x = np.arange(len(SEEDS))
        width = 0.34
        for offset, generation in [(-width / 2, "V2.2 eski"), (width / 2, "V2.2d yeni")]:
            values = frame[frame["generation"] == generation].set_index("model_seed").loc[SEEDS, "max_drawdown"] * 100
            ax.bar(x + offset, values, width, label=generation, color=colors[generation])
        ax.set_xticks(x, [str(seed) for seed in SEEDS])
        ax.set_title(f"{family}: Maksimum drawdown")
        ax.set_xlabel("Seed")
        ax.set_ylabel("Yüzde")
        ax.grid(axis="y", alpha=0.25)
    axes[0].legend()
    _save(fig, plots / "max_drawdown_by_seed.png")

    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))
    for ax, family in zip(axes, FAMILIES):
        frame = summary[summary["family"] == family]
        x = np.arange(len(SEEDS))
        width = 0.34
        for offset, generation in [(-width / 2, "V2.2 eski"), (width / 2, "V2.2d yeni")]:
            values = frame[frame["generation"] == generation].set_index("model_seed").loc[SEEDS, "total_commission_try"]
            ax.bar(x + offset, values, width, label=generation, color=colors[generation])
        ax.set_xticks(x, [str(seed) for seed in SEEDS])
        ax.set_title(f"{family}: Toplam komisyon")
        ax.set_xlabel("Seed")
        ax.set_ylabel("TL")
        ax.grid(axis="y", alpha=0.25)
    axes[0].legend()
    _save(fig, plots / "commission_by_seed.png")

    tpp = weights[weights["instrument"] == "TPP_ON"]
    for family in FAMILIES:
        fig, ax = plt.subplots(figsize=(12, 5.5))
        frame = tpp[tpp["family"] == family]
        for generation in ["V2.2 eski", "V2.2d yeni"]:
            gen = frame[frame["generation"] == generation]
            matrix = gen.pivot(index="execution_date", columns="model_seed", values="posttrade_percent").astype(float)
            dates = pd.to_datetime(matrix.index)
            ax.plot(dates, matrix.mean(axis=1), label=generation, color=colors[generation], linewidth=2.3)
            ax.fill_between(dates, matrix.min(axis=1), matrix.max(axis=1), color=colors[generation], alpha=0.14)
        ax.axhline(5, color="black", linestyle=":", linewidth=1)
        ax.axhline(15, color="black", linestyle=":", linewidth=1)
        ax.set_title(f"{family}: TPP ağırlığı")
        ax.set_ylabel("Yüzde")
        ax.grid(alpha=0.25)
        ax.legend()
        fig.autofmt_xdate()
        _save(fig, plots / f"{family.lower()}_tpp_old_vs_new.png")

    manifest = {
        "schema_version": "bist_stress_rl_v22_vs_v22d_generation_comparison",
        "seeds": SEEDS,
        "families": FAMILIES,
        "contract_checks": contract_checks,
        "comparison_is_paired": True,
        "same_initial_nav_try": 10_000_000.0,
        "same_initial_weights": _load_manifest(old_root / "seed_42" / "inference_manifest.json")["initial_weights"],
        "old_model": "P1_SCENARIO_CONDITIONED V2.2",
        "new_model": "P1_V22D_FINAL V2.2d",
    }
    (output / "comparison_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return output


def main() -> None:
    print(f"GENERATION_COMPARISON_COMPLETE {build()}", flush=True)


if __name__ == "__main__":
    main()
