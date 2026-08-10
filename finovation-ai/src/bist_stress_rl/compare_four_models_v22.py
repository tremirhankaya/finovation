from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "artifacts_v22d" / "four_model_comparison_20260809"
RUNS = OUTPUT / "runs"

MODELS = {
    "P0": {
        "label": "P0 - kriz bilgisi yok (pilot)",
        "color": "#4C78A8",
        "training_status": "pilot",
    },
    "P1_OLD": {
        "label": "P1 - eski senaryo kosullu (final)",
        "color": "#72B7B2",
        "training_status": "final",
    },
    "P2": {
        "label": "P2 - olay hassasiyeti/oracle (pilot)",
        "color": "#B279A2",
        "training_status": "pilot",
    },
    "P1_NEW": {
        "label": "P1 - yeni V2.2d (final)",
        "color": "#F58518",
        "training_status": "final",
    },
}

RUN_DIRS = {
    "P0": RUNS / "p0",
    "P1_OLD": RUNS / "p1_old",
    "P2": RUNS / "p2",
    "P1_NEW": RUNS / "p1_new",
}

SEEDS = (42, 31415)
FAMILIES = ("S1", "S2")


def _manifest(model_key: str, seed: int) -> dict:
    path = RUN_DIRS[model_key] / f"seed{seed}" / "inference_manifest.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _validate_contracts() -> dict:
    reference = _manifest("P1_NEW", SEEDS[0])
    checks: dict[str, dict] = {}
    for model_key in MODELS:
        for seed in SEEDS:
            current = _manifest(model_key, seed)
            key = f"{model_key}_seed{seed}"
            checks[key] = {
                "initial_nav_equal": current["initial_nav_try"] == reference["initial_nav_try"],
                "initial_weights_equal": current["initial_weights"] == reference["initial_weights"],
                "scenario_contract_equal": current["families"] == reference["families"],
                "input_hashes_equal": {
                    name: current["input_data"][name]["sha256"]
                    == reference["input_data"][name]["sha256"]
                    for name in reference["input_data"]
                },
                "quality_checks_pass": bool(current["quality_checks"]["all_mandatory_checks_pass"]),
            }
            flat = [
                checks[key]["initial_nav_equal"],
                checks[key]["initial_weights_equal"],
                checks[key]["scenario_contract_equal"],
                checks[key]["quality_checks_pass"],
                *checks[key]["input_hashes_equal"].values(),
            ]
            if not all(flat):
                raise RuntimeError(f"Comparison contract mismatch: {key}: {checks[key]}")
    return checks


def _load() -> tuple[pd.DataFrame, pd.DataFrame]:
    summaries: list[pd.DataFrame] = []
    daily: list[pd.DataFrame] = []
    for model_key, meta in MODELS.items():
        for seed in SEEDS:
            run = RUN_DIRS[model_key] / f"seed{seed}"
            summary = pd.read_csv(run / "scenario_summary.csv")
            summary.insert(0, "comparison_model", model_key)
            summary.insert(1, "comparison_label", meta["label"])
            summary.insert(2, "training_status", meta["training_status"])
            summaries.append(summary)

            frame = pd.read_csv(run / "daily_overview.csv", parse_dates=["execution_date"])
            frame.insert(0, "comparison_model", model_key)
            frame.insert(1, "comparison_label", meta["label"])
            frame.insert(2, "seed", seed)
            daily.append(frame)
    return pd.concat(summaries, ignore_index=True), pd.concat(daily, ignore_index=True)


def _aggregate(summary: pd.DataFrame) -> pd.DataFrame:
    metrics = [
        "terminal_nav_try",
        "terminal_return",
        "excess_terminal_return",
        "max_drawdown",
        "realized_turnover",
        "total_commission_try",
        "target_update_days",
        "illegal_days",
        "total_reward",
    ]
    grouped = (
        summary.groupby(
            ["comparison_model", "comparison_label", "training_status", "family"],
            as_index=False,
        )[metrics]
        .agg(["mean", "min", "max", "std"])
    )
    grouped.columns = [
        "_".join(str(part) for part in column if part).rstrip("_")
        if isinstance(column, tuple)
        else str(column)
        for column in grouped.columns
    ]
    return grouped


def _plot(summary: pd.DataFrame, daily: pd.DataFrame) -> Path:
    plt.style.use("dark_background")
    fig = plt.figure(figsize=(18, 15), constrained_layout=True)
    grid = fig.add_gridspec(3, 2, height_ratios=[1.35, 1.0, 1.0])

    for column, family in enumerate(FAMILIES):
        ax = fig.add_subplot(grid[0, column])
        subset = daily[daily["family"] == family]
        for model_key, meta in MODELS.items():
            model = subset[subset["comparison_model"] == model_key]
            pivot = model.pivot(index="execution_date", columns="seed", values="nav").sort_index()
            mean = pivot.mean(axis=1)
            ax.plot(mean.index, mean.values / 1e6, color=meta["color"], lw=2.3, label=meta["label"])
            ax.fill_between(
                mean.index,
                pivot.min(axis=1).values / 1e6,
                pivot.max(axis=1).values / 1e6,
                color=meta["color"],
                alpha=0.10,
            )
        passive = subset.groupby("execution_date")["passive_nav"].mean().sort_index()
        ax.plot(passive.index, passive.values / 1e6, color="#EEEEEE", lw=1.8, ls="--", label="Pasif fon")
        scenario = "17 Mart-5 Mayis 2025" if family == "S1" else "26 Agustos-17 Ekim 2025"
        ax.set_title(f"{family}: {scenario}", fontsize=14, weight="bold")
        ax.set_ylabel("NAV (milyon TL)")
        ax.grid(alpha=0.18)
        ax.tick_params(axis="x", rotation=20)
        if column == 0:
            ax.legend(fontsize=8, loc="lower left")

    specs = [
        ("terminal_return", "Donem sonu getiri", "%", 100.0, False),
        ("max_drawdown", "Maksimum drawdown", "%", 100.0, True),
        ("total_commission_try", "Toplam komisyon", "TL", 1.0, True),
        ("target_update_days", "Hedef guncelleme gunu", "gun", 1.0, True),
    ]
    x = np.arange(len(FAMILIES), dtype=float)
    width = 0.19
    offsets = np.linspace(-1.5, 1.5, len(MODELS)) * width
    for idx, (metric, title, unit, scale, lower_better) in enumerate(specs):
        ax = fig.add_subplot(grid[1 + idx // 2, idx % 2])
        for offset, (model_key, meta) in zip(offsets, MODELS.items()):
            means = []
            for family in FAMILIES:
                values = summary[
                    (summary["comparison_model"] == model_key) & (summary["family"] == family)
                ][metric]
                means.append(float(values.mean()) * scale)
            bars = ax.bar(x + offset, means, width, color=meta["color"], label=meta["label"])
            for bar, value in zip(bars, means):
                ax.annotate(
                    f"{value:,.2f}" if abs(value) < 1000 else f"{value:,.0f}",
                    (bar.get_x() + bar.get_width() / 2, bar.get_height()),
                    xytext=(0, 4 if value >= 0 else -13),
                    textcoords="offset points",
                    ha="center",
                    fontsize=7,
                )
        suffix = " (dusuk daha iyi)" if lower_better else ""
        ax.set_title(title + suffix, fontsize=13, weight="bold")
        ax.set_xticks(x, FAMILIES)
        ax.set_ylabel(unit)
        ax.grid(axis="y", alpha=0.18)

    fig.suptitle(
        "Dort model - ayni veri, ayni iki senaryo, ayni 10 milyon TL ve ayni baslangic agirliklari\n"
        "Cizgiler/tohum bantlari: ortak seed 42 ve 31415 | P0 ve P2 pilot, P1 eski ve V2.2d final",
        fontsize=17,
        weight="bold",
    )
    output = OUTPUT / "four_model_comparison.png"
    fig.savefig(output, dpi=180, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)
    return output


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    checks = _validate_contracts()
    summary, daily = _load()
    aggregate = _aggregate(summary)
    summary.to_csv(OUTPUT / "all_model_scenario_results.csv", index=False)
    daily.to_csv(OUTPUT / "daily_nav_all_four_models.csv", index=False)
    aggregate.to_csv(OUTPUT / "aggregate_four_model_comparison.csv", index=False)
    plot = _plot(summary, daily)
    reference = _manifest("P1_NEW", SEEDS[0])
    manifest = {
        "schema_version": "bist_stress_rl_four_model_historical_comparison",
        "models": MODELS,
        "common_seeds": list(SEEDS),
        "families": reference["families"],
        "initial_nav_try": reference["initial_nav_try"],
        "initial_weights": reference["initial_weights"],
        "contract_checks": checks,
        "methodological_note": (
            "P0 and P2 are pilot-budget checkpoints; old P1 and new V2.2d are final-budget checkpoints. "
            "All historical replays use the same two seeds available across all four model families."
        ),
        "plot": str(plot.resolve()),
    }
    (OUTPUT / "comparison_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"FOUR_MODEL_COMPARISON_COMPLETE {OUTPUT.resolve()}")


if __name__ == "__main__":
    main()
