from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"]


def _save(fig: plt.Figure, output: Path, name: str, manifest: list[dict]) -> None:
    fig.tight_layout()
    path = output / name
    fig.savefig(path, dpi=170, bbox_inches="tight")
    plt.close(fig)
    manifest.append({"file": name, "bytes": int(path.stat().st_size)})


def _format_pct_axis(axis, which: str = "y") -> None:
    from matplotlib.ticker import PercentFormatter

    formatter = PercentFormatter(1.0)
    getattr(axis, f"{which}axis").set_major_formatter(formatter)


def _p0_charts(p0: Path, locked: Path, output: Path, manifest: list[dict]) -> None:
    metrics = pd.read_csv(p0 / "counterfactual_metrics.csv")
    effects = pd.read_csv(p0 / "paired_counterfactual_effects.csv")
    rules = pd.read_csv(p0 / "rule_trigger_audit.csv")
    bounds = pd.read_csv(p0 / "action_bound_by_dimension.csv")
    rewards = pd.read_csv(locked / "reward_summary.csv")
    steps = pd.read_parquet(
        p0 / "original_replay_step_log.parquet", columns=["action_status", "pre_trade_legal"]
    )

    path_means = metrics.groupby(["strategy", "path_id"], as_index=False).agg(
        terminal_return=("terminal_return", "mean"), max_drawdown=("max_drawdown", "mean")
    )
    strategy = path_means.groupby("strategy", as_index=False).agg(
        terminal_return=("terminal_return", "mean"), max_drawdown=("max_drawdown", "mean")
    ).sort_values("terminal_return")
    labels = [value.replace("_COMPLIANCE", "").replace("POLICY_", "").replace("_", "\n") for value in strategy["strategy"]]
    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    axes[0].bar(labels, strategy["terminal_return"], color=COLORS[: len(strategy)])
    axes[0].set_title("P0 strategy mean terminal return\n(path is the statistical unit)")
    axes[0].set_ylabel("Terminal return")
    _format_pct_axis(axes[0])
    axes[1].bar(labels, strategy["max_drawdown"], color=COLORS[: len(strategy)])
    axes[1].set_title("P0 strategy mean maximum drawdown")
    axes[1].set_ylabel("Maximum drawdown")
    _format_pct_axis(axes[1])
    for axis in axes:
        axis.tick_params(axis="x", labelrotation=25)
        axis.grid(axis="y", alpha=0.25)
    _save(fig, output, "01_p0_strategy_return_mdd.png", manifest)

    effect_columns = [
        "active_timing_return",
        "policy_target_vs_mechanical_return",
        "policy_target_vs_static_defensive_return",
        "state_time_sensitivity_return",
        "state_vs_validation_medoid_return",
    ]
    fig, axes = plt.subplots(2, 3, figsize=(16, 9))
    for axis, column, color in zip(axes.flat, effect_columns, COLORS):
        path_values = effects.groupby("path_id")[column].mean()
        axis.hist(path_values, bins=24, color=color, alpha=0.85)
        axis.axvline(0, color="black", lw=1)
        axis.axvline(path_values.mean(), color="#facc15", lw=2, label=f"mean={path_values.mean():.3%}")
        axis.set_title(column.replace("_", " "))
        axis.legend(fontsize=8)
        _format_pct_axis(axis, "x")
        axis.grid(alpha=0.2)
    axes.flat[-1].axis("off")
    _save(fig, output, "02_p0_paired_effect_distributions.png", manifest)

    status_label = steps["action_status"].astype(str).copy()
    rebalance = status_label == "REBALANCE"
    status_label.loc[rebalance & steps["pre_trade_legal"].astype(bool)] = "VOLUNTARY_REBALANCE"
    status_label.loc[rebalance & ~steps["pre_trade_legal"].astype(bool)] = "DECODER_REBALANCE_ON_FORCED_DAY"
    status = status_label.value_counts().sort_values()
    fig, axis = plt.subplots(figsize=(11, 6))
    axis.barh(status.index, status.values, color=COLORS[0])
    axis.set_title("Original replay action status counts")
    axis.set_xlabel("Day rows across 384 episodes")
    axis.grid(axis="x", alpha=0.25)
    for index, value in enumerate(status.values):
        axis.text(value, index, f" {value:,}", va="center")
    _save(fig, output, "03_action_status_counts.png", manifest)

    rule_counts = rules["violation"].value_counts().sort_values()
    fig, axis = plt.subplots(figsize=(10, 5.5))
    axis.barh(rule_counts.index, rule_counts.values, color=COLORS[1])
    axis.set_title("Pre-trade prospectus drift triggers")
    axis.set_xlabel("Trigger count (violations may coexist on one day)")
    axis.grid(axis="x", alpha=0.25)
    _save(fig, output, "04_rule_trigger_counts.png", manifest)

    all_bounds = bounds[(bounds["model_seed"].astype(str) == "ALL") & (bounds["family"] == "ALL")].copy()
    all_bounds = all_bounds.sort_values("action_dimension")
    fig, axis = plt.subplots(figsize=(12, 5.5))
    axis.bar(all_bounds["action_dimension"].astype(str), all_bounds["bound_hit_fraction"], color=COLORS[4])
    axis.axhline(0.001, color="black", ls="--", lw=1, label="0.1% diagnostic line")
    axis.set_title("Action saturation by raw action dimension")
    axis.set_xlabel("Action dimension")
    axis.set_ylabel("Bound-hit fraction")
    axis.legend()
    axis.grid(axis="y", alpha=0.25)
    _format_pct_axis(axis)
    _save(fig, output, "05_action_saturation.png", manifest)

    reward_all = rewards[rewards["model_seed"].astype(str) == "ALL"].copy()
    reward_all["label"] = reward_all["component"].str.replace("_reward_component", "", regex=False).str.replace("_", " ")
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))
    axes[0].bar(reward_all["label"], reward_all["sum"], color=[COLORS[2] if value >= 0 else COLORS[1] for value in reward_all["sum"]])
    axes[0].set_title("Reward component sums")
    axes[0].tick_params(axis="x", labelrotation=25)
    axes[0].grid(axis="y", alpha=0.25)
    x = np.arange(len(reward_all))
    axes[1].bar(x, reward_all["positive_days"], label="positive", color=COLORS[2])
    axes[1].bar(x, reward_all["negative_days"], bottom=reward_all["positive_days"], label="negative", color=COLORS[1])
    axes[1].bar(x, reward_all["zero_days"], bottom=reward_all["positive_days"] + reward_all["negative_days"], label="zero", color="#94a3b8")
    axes[1].set_xticks(x, reward_all["label"], rotation=25)
    axes[1].set_title("Reward sign counts by day")
    axes[1].legend()
    _save(fig, output, "06_reward_components.png", manifest)


def _controlled_charts(controlled: Path, output: Path, manifest: list[dict]) -> None:
    overall_path = controlled / "controlled_variant_overall_summary.csv"
    if not overall_path.exists():
        return
    overall = pd.read_csv(overall_path).sort_values("variant")
    effects = pd.read_csv(controlled / "controlled_paired_effects.csv")
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    for axis, column, title in (
        (axes[0], "mean_excess_return", "Mean excess return"),
        (axes[1], "mean_mdd_improvement", "Mean MDD improvement"),
        (axes[2], "mean_success_rate", "Validation success rate"),
    ):
        axis.bar(overall["variant"], overall[column], color=COLORS[: len(overall)])
        axis.set_title(title)
        _format_pct_axis(axis)
        axis.grid(axis="y", alpha=0.25)
    _save(fig, output, "07_controlled_variant_summary.png", manifest)

    effect_columns = [column for column in effects if column not in {"model_seed", "path_id"}]
    fig, axes = plt.subplots(2, 2, figsize=(13, 9))
    for axis, column, color in zip(axes.flat, effect_columns, COLORS):
        path_values = effects.groupby("path_id")[column].mean()
        axis.hist(path_values, bins=20, color=color, alpha=0.85)
        axis.axvline(0, color="black", lw=1)
        axis.axvline(path_values.mean(), color="#facc15", lw=2)
        axis.set_title(column.replace("_", " "))
        _format_pct_axis(axis, "x")
        axis.grid(alpha=0.2)
    _save(fig, output, "08_controlled_paired_effects.png", manifest)


def _challenge_charts(challenge: Path, output: Path, manifest: list[dict]) -> None:
    metrics_path = challenge / "challenge_metrics.csv"
    if not metrics_path.exists():
        return
    metrics = pd.read_csv(metrics_path)
    summary = metrics.groupby(["family", "strategy"], as_index=False).agg(
        terminal_return=("terminal_return", "mean"), max_drawdown=("max_drawdown", "mean"), trade_days=("trade_days", "mean")
    )
    families = list(summary["family"].unique())
    strategies = list(summary["strategy"].unique())
    x = np.arange(len(families))
    width = 0.8 / len(strategies)
    fig, axes = plt.subplots(2, 1, figsize=(15, 10), sharex=True)
    for index, strategy in enumerate(strategies):
        frame = summary[summary["strategy"] == strategy].set_index("family").reindex(families)
        offset = (index - (len(strategies) - 1) / 2) * width
        axes[0].bar(x + offset, frame["terminal_return"], width, label=strategy, color=COLORS[index])
        axes[1].bar(x + offset, frame["max_drawdown"], width, label=strategy, color=COLORS[index])
    axes[0].set_title("External challenge terminal return")
    axes[1].set_title("External challenge maximum drawdown")
    axes[1].set_xticks(x, families, rotation=15)
    for axis in axes:
        _format_pct_axis(axis)
        axis.grid(axis="y", alpha=0.25)
        axis.legend(fontsize=8)
    _save(fig, output, "09_external_challenge_return_mdd.png", manifest)


def build_audit_charts(p0: str, locked: str, controlled: str, challenge: str, output: str) -> Path:
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    _p0_charts(Path(p0), Path(locked), output_path, manifest)
    _controlled_charts(Path(controlled), output_path, manifest)
    _challenge_charts(Path(challenge), output_path, manifest)
    (output_path / "chart_manifest.json").write_text(
        json.dumps({"charts": manifest}, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--p0", required=True)
    parser.add_argument("--locked", required=True)
    parser.add_argument("--controlled", required=True)
    parser.add_argument("--challenge", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    print(build_audit_charts(args.p0, args.locked, args.controlled, args.challenge, args.output))


if __name__ == "__main__":
    main()
