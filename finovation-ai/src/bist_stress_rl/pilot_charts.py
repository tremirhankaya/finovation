from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.ticker import PercentFormatter


def build_pilot_charts(v21a: str, v21b: str, output: str) -> Path:
    sources = {"V2.1a gate/maintenance": Path(v21a), "V2.1b always-target": Path(v21b)}
    frames = []
    for variant, root in sources.items():
        frame = pd.read_csv(root / "validation_seed_summary.csv")
        frame.insert(0, "variant", variant)
        frames.append(frame)
    summary = pd.concat(frames, ignore_index=True)
    summary["label"] = summary["variant"] + "\nseed " + summary["model_seed"].astype(str)
    output_path = Path(output)
    output_path.mkdir(parents=True, exist_ok=True)
    colors = ["#2563eb", "#60a5fa", "#dc2626", "#fb7185"]

    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    plots = (
        ("mean_excess_return", "Mean excess return", True),
        ("mean_mdd_improvement", "Mean MDD improvement", True),
        ("median_turnover", "Median episode one-way turnover", False),
        ("mean_commission_try", "Mean commission per episode (TRY)", False),
    )
    for axis, (column, title, percentage) in zip(axes.flat, plots):
        axis.bar(summary["label"], summary[column], color=colors)
        axis.set_title(title)
        axis.tick_params(axis="x", labelrotation=12)
        axis.grid(axis="y", alpha=0.25)
        axis.axhline(0, color="black", lw=0.8)
        if percentage:
            axis.yaxis.set_major_formatter(PercentFormatter(1.0))
    fig.tight_layout()
    first = output_path / "10_v21a_v21b_seed_comparison.png"
    fig.savefig(first, dpi=170, bbox_inches="tight")
    plt.close(fig)

    paired = pd.read_csv(sources["V2.1b always-target"] / "policy_vs_static_by_path.csv")
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))
    for axis, column, title, color in (
        (
            axes[0],
            "policy_minus_static_return",
            "V2.1b minus static defensive: terminal return",
            "#16a34a",
        ),
        (
            axes[1],
            "policy_minus_static_mdd_improvement",
            "V2.1b minus static defensive: MDD improvement",
            "#9333ea",
        ),
    ):
        values = paired[column]
        axis.hist(values, bins=20, color=color, alpha=0.85)
        axis.axvline(0, color="black", lw=1)
        axis.axvline(values.mean(), color="#facc15", lw=2, label=f"mean={values.mean():.3%}")
        axis.set_title(title)
        axis.xaxis.set_major_formatter(PercentFormatter(1.0))
        axis.legend()
        axis.grid(alpha=0.2)
    fig.tight_layout()
    second = output_path / "11_v21b_vs_static_paired_paths.png"
    fig.savefig(second, dpi=170, bbox_inches="tight")
    plt.close(fig)

    payload = {
        "charts": [
            {"file": first.name, "bytes": int(first.stat().st_size)},
            {"file": second.name, "bytes": int(second.stat().st_size)},
        ]
    }
    (output_path / "v21_chart_manifest.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--v21a", required=True)
    parser.add_argument("--v21b", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    print(build_pilot_charts(args.v21a, args.v21b, args.output))


if __name__ == "__main__":
    main()
