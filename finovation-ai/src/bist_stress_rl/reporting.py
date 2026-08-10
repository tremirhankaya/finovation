from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots


def _clean_component(value: str) -> str:
    return value.replace("_reward_component", "").replace("reward_", "")


def build_evaluation_dashboard(
    output_dir: Path,
    metrics: pd.DataFrame,
    steps: pd.DataFrame,
    seed_summary: pd.DataFrame,
    family_summary: pd.DataFrame,
    rewards: pd.DataFrame,
    baselines: pd.DataFrame,
) -> Path:
    output_dir = Path(output_dir)
    figures: list[tuple[str, go.Figure]] = []
    metrics = metrics.copy()
    metrics["model_seed_label"] = metrics["model_seed"].astype(str)
    steps = steps.copy()
    steps["model_seed_label"] = steps["model_seed"].astype(str)

    comparison = seed_summary.copy()
    passive_mean = metrics.groupby("model_seed")["passive_terminal_return"].mean().to_numpy()
    comparison["passive_mean_return"] = passive_mean
    melted = comparison.melt(
        id_vars="model_seed",
        value_vars=["mean_terminal_return", "passive_mean_return"],
        var_name="portfolio",
        value_name="return",
    )
    figures.append(("Seed Bazında PPO ve Pasif Ortalama Getiri", px.bar(
        melted, x="model_seed", y="return", color="portfolio", barmode="group"
    )))
    figures.append(("Seed Bazında Excess Getiri Dağılımı", px.box(
        metrics, x="model_seed_label", y="excess_terminal_return", points="outliers", color="model_seed_label"
    )))
    figures.append(("Senaryo Ailesi Bazında Excess Getiri", px.box(
        metrics, x="family", y="excess_terminal_return", color="family", points=False
    )))
    figures.append(("PPO-Pasif Terminal Getiri Karşılaştırması", px.scatter(
        metrics, x="passive_terminal_return", y="terminal_return", color="model_seed_label",
        facet_col="family", facet_col_wrap=2, hover_data=["path_id", "success"]
    )))
    figures[-1][1].add_shape(type="line", x0=-0.5, y0=-0.5, x1=0.3, y1=0.3, line=dict(dash="dash"))
    figures.append(("PPO-Pasif Maksimum Drawdown", px.scatter(
        metrics, x="passive_max_drawdown", y="max_drawdown", color="model_seed_label",
        hover_data=["path_id", "family"]
    )))
    figures[-1][1].add_shape(type="line", x0=0, y0=0, x1=0.5, y1=0.5, line=dict(dash="dash"))
    figures.append(("Seed Bazında Başarılı Episode Oranı", px.bar(
        seed_summary, x=seed_summary["model_seed"].astype(str), y="success_rate", text_auto=".1%"
    )))
    figures.append(("Aile Bazında Başarılı Episode Oranı", px.bar(
        family_summary, x="family", y="success_rate", color="family", text_auto=".1%"
    )))
    figures.append(("Episode Turnover Dağılımı", px.box(
        metrics, x="model_seed_label", y="total_turnover", color="model_seed_label", points=False
    )))
    figures.append(("İşlem Yapılan Gün Sayısı", px.box(
        metrics, x="model_seed_label", y="trade_days", color="model_seed_label", points=False
    )))
    figures.append(("Toplam Komisyon Dağılımı", px.box(
        metrics, x="model_seed_label", y="total_commission_try", color="model_seed_label", points=False
    )))
    figures.append(("Toplam Reward Dağılımı", px.box(
        metrics, x="model_seed_label", y="total_reward", color="model_seed_label", points=False
    )))
    figures.append(("Aile Bazında MDD İyileşmesi", px.box(
        metrics, x="family", y="mdd_improvement", color="family", points=False
    )))
    figures.append(("Terminal Getiri Histogramı", px.histogram(
        metrics, x="terminal_return", color="model_seed_label", marginal="box", nbins=40, barmode="overlay", opacity=0.55
    )))
    figures.append(("Excess Getiri ECDF", px.ecdf(
        metrics, x="excess_terminal_return", color="model_seed_label"
    )))

    reward_all = rewards[rewards["model_seed"] != "ALL"].copy()
    reward_all["component"] = reward_all["component"].map(_clean_component)
    figures.append(("Seed Bazında Reward Bileşen Toplamları", px.bar(
        reward_all, x="model_seed", y="sum", color="component", barmode="group"
    )))
    reward_counts = reward_all.melt(
        id_vars=["model_seed", "component"],
        value_vars=["positive_days", "negative_days", "zero_days"],
        var_name="sign",
        value_name="days",
    )
    figures.append(("Reward/Ceza Bileşenlerinin Gün Sayıları", px.bar(
        reward_counts, x="component", y="days", color="sign", facet_col="model_seed", barmode="group"
    )))
    figures.append(("Heavy Hisse Sayısı Dağılımı", px.histogram(
        steps, x="applied_heavy_count", color="model_seed_label", barmode="group", histnorm="percent"
    )))
    figures.append(("TPP Ağırlığı Dağılımı", px.histogram(
        steps, x="weight_TPP_ON", color="model_seed_label", barmode="overlay", opacity=0.55, nbins=40
    )))
    action_counts = steps.groupby(["model_seed_label", "action_status"], as_index=False).size()
    figures.append(("Action Durumu Dağılımı", px.bar(
        action_counts, x="model_seed_label", y="size", color="action_status", barmode="stack"
    )))

    weight_columns = [column for column in steps.columns if column.startswith("weight_")]
    mean_weights = steps.groupby("model_seed_label")[weight_columns].mean()
    mean_weights.columns = [column.replace("weight_", "") for column in mean_weights.columns]
    figures.append(("Seed-Varlık Ortalama Ağırlık Isı Haritası", px.imshow(
        mean_weights, labels=dict(x="Varlık", y="Seed", color="Ortalama Ağırlık"), aspect="auto"
    )))
    heavy_sets = steps.groupby(["model_seed_label", "path_id"])[weight_columns[:-1]].mean()
    heavy_frequency = (heavy_sets > 0.05).groupby(level=0).mean()
    heavy_frequency.columns = [column.replace("weight_", "") for column in heavy_frequency.columns]
    figures.append(("Hisselerin Heavy Olma Frekansı", px.imshow(
        heavy_frequency, labels=dict(x="Hisse", y="Seed", color="Heavy Frekansı"), aspect="auto"
    )))

    baseline_summary = baselines.groupby("baseline", as_index=False).agg(
        mean_terminal_return=("terminal_return", "mean"),
        mean_max_drawdown=("max_drawdown", "mean"),
        median_turnover=("total_turnover", "median"),
    )
    figures.append(("Baseline Ortalama Terminal Getirileri", px.bar(
        baseline_summary, x="baseline", y="mean_terminal_return", color="baseline", text_auto=".2%"
    )))
    figures.append(("Baseline Getiri-Risk Haritası", px.scatter(
        baseline_summary, x="mean_max_drawdown", y="mean_terminal_return", size="median_turnover",
        color="baseline", hover_name="baseline"
    )))

    seed_pivot = metrics.pivot(index="path_id", columns="model_seed_label", values="excess_terminal_return")
    figures.append(("Seed Excess Getiri Korelasyonu", px.imshow(
        seed_pivot.corr(), text_auto=".2f", zmin=-1, zmax=1, color_continuous_scale="RdBu_r"
    )))
    metric_correlation = metrics[
        ["terminal_return", "excess_terminal_return", "max_drawdown", "mdd_improvement", "total_reward", "total_turnover", "trade_days"]
    ].corr()
    figures.append(("Test Metrikleri Korelasyon Haritası", px.imshow(
        metric_correlation, text_auto=".2f", zmin=-1, zmax=1, color_continuous_scale="RdBu_r"
    )))

    example_seed = str(sorted(metrics["model_seed"].unique())[0])
    example_frames = []
    for family in sorted(metrics["family"].unique()):
        candidate = metrics[(metrics["model_seed_label"] == example_seed) & (metrics["family"] == family)].iloc[0]
        frame = steps[(steps["model_seed_label"] == example_seed) & (steps["path_id"] == candidate["path_id"])].copy()
        frame["PPO"] = frame["nav"] / frame["nav"].iloc[0]
        frame["Pasif"] = frame["passive_nav"] / frame["passive_nav"].iloc[0]
        frame["example_family"] = family
        example_frames.append(frame)
    examples = pd.concat(example_frames, ignore_index=True)
    nav_long = examples.melt(
        id_vars=["scenario_day", "example_family"], value_vars=["PPO", "Pasif"],
        var_name="portfolio", value_name="normalized_nav"
    )
    figures.append(("Her Aileden Örnek Günlük NAV Eğrisi", px.line(
        nav_long, x="scenario_day", y="normalized_nav", color="portfolio",
        facet_col="example_family", facet_col_wrap=2
    )))
    reward_long = examples.melt(
        id_vars=["scenario_day", "example_family"],
        value_vars=["alpha_reward_component", "commission_reward_component", "mdd_reward_component", "turnover_reward_component"],
        var_name="component", value_name="value",
    )
    reward_long["component"] = reward_long["component"].map(_clean_component)
    figures.append(("Örnek Yollarda Günlük Reward Bileşenleri", px.line(
        reward_long, x="scenario_day", y="value", color="component",
        facet_col="example_family", facet_col_wrap=2
    )))

    first_example = examples[examples["example_family"] == sorted(examples["example_family"].unique())[0]]
    stack = go.Figure()
    for column in weight_columns:
        stack.add_trace(go.Scatter(
            x=first_example["scenario_day"], y=first_example[column], mode="lines",
            stackgroup="one", name=column.replace("weight_", "")
        ))
    figures.append(("Örnek Günlük 17 Varlık Ağırlık Dağılımı", stack))

    artifact_root = output_dir.parents[1]
    training_rows = []
    validation_rows = []
    selected_seeds = set(metrics["model_seed"].unique())
    for run in artifact_root.joinpath("runs").glob("final_v2_seed*"):
        manifest_path = run / "run_manifest.json"
        if not manifest_path.exists():
            continue
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        seed = int(manifest["model_seed"])
        if seed not in selected_seeds:
            continue
        episode_path = run / "episode_summary.csv"
        if episode_path.exists():
            frame = pd.read_csv(episode_path)
            frame["model_seed_label"] = str(seed)
            frame["reward_ma_100"] = frame["total_reward"].rolling(100, min_periods=20).mean()
            frame["excess_ma_100"] = frame["excess_return"].rolling(100, min_periods=20).mean()
            frame["turnover_ma_100"] = frame["total_turnover"].rolling(100, min_periods=20).mean()
            training_rows.append(frame)
        eval_path = run / "eval_logs" / "evaluations.npz"
        if eval_path.exists():
            data = np.load(eval_path)
            for step, result in zip(data["timesteps"], data["results"]):
                validation_rows.append({"model_seed_label": str(seed), "timesteps": int(step), "mean_reward": float(np.mean(result))})
    if training_rows:
        training = pd.concat(training_rows, ignore_index=True)
        figures.append(("Eğitim Reward Öğrenme Eğrisi (MA100)", px.line(
            training, x="timesteps", y="reward_ma_100", color="model_seed_label"
        )))
        figures.append(("Eğitim Excess Return Öğrenme Eğrisi (MA100)", px.line(
            training, x="timesteps", y="excess_ma_100", color="model_seed_label"
        )))
        figures.append(("Eğitim Turnover Eğrisi (MA100)", px.line(
            training, x="timesteps", y="turnover_ma_100", color="model_seed_label"
        )))
    if validation_rows:
        figures.append(("Sabit Validation Reward Eğrisi", px.line(
            pd.DataFrame(validation_rows), x="timesteps", y="mean_reward", color="model_seed_label", markers=True
        )))

    for title, figure in figures:
        figure.update_layout(
            title=title,
            template="plotly_white",
            margin=dict(l=50, r=30, t=70, b=50),
            legend_title_text="",
        )
    css = """
    body {font-family: Arial, sans-serif; margin: 0; background: #f4f6f8; color: #17212b;}
    header {padding: 24px 32px; background: #17212b; color: white;}
    .grid {display: grid; grid-template-columns: repeat(auto-fit, minmax(720px, 1fr)); gap: 18px; padding: 18px;}
    .card {background: white; border-radius: 10px; padding: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.08);}
    .card h2 {font-size: 16px; margin: 10px 16px 0;}
    """
    parts = [
        "<!doctype html><html><head><meta charset='utf-8'><title>BIST Stress RL V2 Değerlendirme</title>",
        f"<style>{css}</style></head><body>",
        f"<header><h1>BIST Stress RL V2 — Kilitli Test Değerlendirmesi</h1><p>{len(metrics)} PPO episode, {metrics['path_id'].nunique()} ortak yol, {metrics['model_seed'].nunique()} model seed, {len(figures)} grafik</p></header><main class='grid'>",
    ]
    for index, (title, figure) in enumerate(figures):
        parts.append(f"<section class='card'><h2>{index + 1}. {title}</h2>")
        parts.append(figure.to_html(full_html=False, include_plotlyjs="inline" if index == 0 else False))
        parts.append("</section>")
    parts.append("</main></body></html>")
    dashboard = output_dir / "evaluation_dashboard.html"
    dashboard.write_text("".join(parts), encoding="utf-8")
    (output_dir / "chart_manifest.json").write_text(
        json.dumps({"chart_count": len(figures), "charts": [title for title, _ in figures]}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return dashboard
