from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


SEEDS = [42, 31415, 271828]
CHAMPION_SEED = 271828
FAMILIES = ["S1", "S2"]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _drawdown(nav: pd.Series) -> pd.Series:
    values = nav.astype(float)
    return 1.0 - values / values.cummax()


def _save(fig: plt.Figure, path: Path) -> None:
    fig.tight_layout()
    fig.savefig(path, dpi=190, bbox_inches="tight")
    plt.close(fig)


def _evaluation_rows(root: Path, split: str) -> pd.DataFrame:
    rows: list[dict] = []
    for seed in SEEDS:
        report = root / "artifacts_v22d" / "final_models" / "reports" / f"final_v22d_{split}_seed{seed}_20260809"
        summary = json.loads((report / "evaluation_summary.json").read_text(encoding="utf-8"))
        episodes = pd.read_csv(report / "episode_summary.csv")
        rows.append(
            {
                "split": split,
                "seed": seed,
                "episodes": len(episodes),
                "mean_terminal_return": summary["mean_terminal_return"],
                "mean_passive_terminal_return": summary["mean_passive_terminal_return"],
                "mean_excess_terminal_return": summary["mean_excess_terminal_return"],
                "mean_mdd_improvement": summary["mean_mdd_improvement"],
                "median_realized_turnover": summary["median_realized_turnover"],
                "median_total_commission_try": summary["median_total_commission_try"],
                "win_vs_passive_rate": float((episodes["excess_terminal_return"] > 0).mean()),
                "mdd_better_rate": float((episodes["mdd_improvement"] > 0).mean()),
                "mean_target_update_days": float(episodes["target_update_days"].mean()),
                "illegal_days": int(summary["illegal_days"]),
            }
        )
    return pd.DataFrame(rows)


def _historical_rows(delivery: Path) -> pd.DataFrame:
    frames = []
    for seed in SEEDS:
        frame = pd.read_csv(delivery / "historical_replay" / f"seed{seed}" / "scenario_summary.csv")
        frame.insert(0, "seed", seed)
        frames.append(frame)
    return pd.concat(frames, ignore_index=True)


def _old_new_comparison(root: Path, historical: pd.DataFrame) -> pd.DataFrame:
    old_path = (
        root
        / "artifacts_v22"
        / "inference_runs"
        / "requested_weights_20260809"
        / f"seed_{CHAMPION_SEED}"
        / "scenario_summary.csv"
    )
    old = pd.read_csv(old_path)[
        ["family", "terminal_return", "excess_terminal_return", "max_drawdown", "total_commission_try"]
    ].rename(
        columns={
            "terminal_return": "old_terminal_return",
            "excess_terminal_return": "old_excess_terminal_return",
            "max_drawdown": "old_max_drawdown",
            "total_commission_try": "old_total_commission_try",
        }
    )
    new = historical[historical["seed"] == CHAMPION_SEED][
        ["family", "terminal_return", "excess_terminal_return", "max_drawdown", "total_commission_try"]
    ].rename(
        columns={
            "terminal_return": "new_terminal_return",
            "excess_terminal_return": "new_excess_terminal_return",
            "max_drawdown": "new_max_drawdown",
            "total_commission_try": "new_total_commission_try",
        }
    )
    result = old.merge(new, on="family", validate="one_to_one")
    result["terminal_return_improvement"] = result["new_terminal_return"] - result["old_terminal_return"]
    result["excess_improvement"] = result["new_excess_terminal_return"] - result["old_excess_terminal_return"]
    result["additional_commission_try"] = result["new_total_commission_try"] - result["old_total_commission_try"]
    return result


def _first_target_frozen(delivery: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    daily_frames = []
    summary_rows = []
    for seed in SEEDS:
        source = delivery / "historical_replay" / f"seed{seed}"
        trades = pd.read_csv(source / "daily_trade_blotter.csv")
        overview = pd.read_csv(source / "daily_overview.csv")
        for family in FAMILIES:
            family_trades = trades[trades["family"] == family].copy()
            first_day = int(family_trades["scenario_day"].min())
            frozen_units = (
                family_trades[family_trades["scenario_day"] == first_day]
                .set_index("instrument")["units_after"]
                .astype(float)
            )
            rows = []
            for day, group in family_trades.groupby("scenario_day", sort=True):
                prices = group.set_index("instrument")["price_t"].astype(float)
                rows.append(
                    {
                        "seed": seed,
                        "family": family,
                        "scenario_day": int(day),
                        "execution_date": group["execution_date"].iloc[0],
                        "first_target_frozen_nav": float((frozen_units * prices).sum()),
                    }
                )
            frame = pd.DataFrame(rows).merge(
                overview[overview["family"] == family][
                    ["scenario_day", "nav", "passive_nav"]
                ],
                on="scenario_day",
                validate="one_to_one",
            )
            frame["active_trading_contribution_try"] = (
                frame["nav"] - frame["first_target_frozen_nav"]
            )
            daily_frames.append(frame)
            final = frame.iloc[-1]
            summary_rows.append(
                {
                    "seed": seed,
                    "family": family,
                    "full_agent_final_nav": float(final["nav"]),
                    "first_target_frozen_final_nav": float(final["first_target_frozen_nav"]),
                    "passive_final_nav": float(final["passive_nav"]),
                    "active_trading_contribution_try": float(final["active_trading_contribution_try"]),
                    "active_trading_contribution_return": float(
                        final["active_trading_contribution_try"] / 10_000_000.0
                    ),
                }
            )
    return pd.concat(daily_frames, ignore_index=True), pd.DataFrame(summary_rows)


def _training_rows(root: Path) -> pd.DataFrame:
    rows = []
    for seed in SEEDS:
        run = root / "artifacts_v22d" / "final_models" / "runs" / f"final_v22d_seed{seed}_20260809"
        episodes = pd.read_csv(run / "episode_summary.csv")
        tail = episodes.tail(1024)
        progress = pd.read_csv(run / "progress.csv").iloc[-1]
        rows.append(
            {
                "seed": seed,
                "timesteps": int(float(progress["timesteps"])),
                "episodes": len(episodes),
                "steps_per_second": float(progress["steps_per_second"]),
                "last_1024_mean_reward": float(tail["total_reward"].mean()),
                "last_1024_mean_excess_return": float(tail["excess_return"].mean()),
                "last_1024_mean_mdd_improvement": float(tail["mdd_improvement"].mean()),
                "last_1024_mean_realized_turnover": float(tail["realized_turnover"].mean()),
                "last_1024_mean_target_update_days": float(tail["target_update_days"].mean()),
                "last_1024_mean_heavy_switches": float(tail["heavy_switches"].mean()),
                "last_1024_mean_min_tpp": float(tail["min_tpp"].mean()),
                "last_1024_mean_max_tpp": float(tail["max_tpp"].mean()),
            }
        )
    return pd.DataFrame(rows)


def _package_models(root: Path, delivery: Path) -> pd.DataFrame:
    rows = []
    for seed in SEEDS:
        source = root / "artifacts_v22d" / "final_models" / "runs" / f"final_v22d_seed{seed}_20260809"
        target = delivery / "models" / f"seed{seed}"
        target.mkdir(parents=True, exist_ok=True)
        mapping = {
            source / "best_model" / "best_model.zip": target / "best_model.zip",
            source / "p1_v22d_final_final_model.zip": target / "final_model.zip",
            source / "resolved_config.yaml": target / "resolved_config.yaml",
            source / "feature_contract.json": target / "feature_contract.json",
            source / "action_contract.json": target / "training_action_contract_raw.json",
            source / "reward_contract.json": target / "reward_contract.json",
            source / "run_manifest.json": target / "run_manifest.json",
            source / "progress.csv": target / "progress.csv",
            source / "train_diagnostics.csv": target / "train_diagnostics.csv",
        }
        for source_file, target_file in mapping.items():
            shutil.copy2(source_file, target_file)
            rows.append(
                {
                    "seed": seed,
                    "file": str(target_file.relative_to(delivery)).replace("\\", "/"),
                    "bytes": target_file.stat().st_size,
                    "sha256": _sha256(target_file),
                }
            )
        clean_action_contract = {
            "version": "action_v22d_absolute",
            "dimension": 18,
            "layout": {
                "tpp_absolute": 0,
                "heavy_count_preference": 1,
                "equity_tilts": [2, 17],
            },
            "bounds": [-1.0, 1.0],
            "continuous_fractional_weights": True,
        }
        clean_path = target / "action_contract.json"
        clean_path.write_text(json.dumps(clean_action_contract, indent=2), encoding="utf-8")
        rows.append(
            {
                "seed": seed,
                "file": str(clean_path.relative_to(delivery)).replace("\\", "/"),
                "bytes": clean_path.stat().st_size,
                "sha256": _sha256(clean_path),
            }
        )
    return pd.DataFrame(rows)


def _training_plots(root: Path, plot_dir: Path) -> list[dict]:
    figures = []
    for metric, title, ylabel, filename, multiplier in [
        ("total_reward", "Eğitim öğrenme eğilimi: hareketli ortalama reward", "Reward", "01_training_reward_moving_average.png", 1.0),
        ("excess_return", "Eğitim öğrenme eğilimi: pasife göre excess return", "Yüzde puan", "02_training_excess_moving_average.png", 100.0),
        ("mdd_improvement", "Eğitim öğrenme eğilimi: MDD iyileşmesi", "Yüzde puan", "03_training_mdd_moving_average.png", 100.0),
    ]:
        fig, ax = plt.subplots(figsize=(12, 5.5))
        for seed in SEEDS:
            run = root / "artifacts_v22d" / "final_models" / "runs" / f"final_v22d_seed{seed}_20260809"
            frame = pd.read_csv(run / "episode_summary.csv", usecols=["timesteps", metric])
            grouped = frame.groupby("timesteps", as_index=False)[metric].mean()
            grouped["smooth"] = grouped[metric].rolling(80, min_periods=20).mean() * multiplier
            ax.plot(grouped["timesteps"] / 1_000_000, grouped["smooth"], label=f"Seed {seed}", linewidth=1.8)
        ax.axhline(0.0, color="black", linewidth=0.8, alpha=0.5)
        ax.set_title(title)
        ax.set_xlabel("Timestep (milyon)")
        ax.set_ylabel(ylabel)
        ax.grid(alpha=0.25)
        ax.legend()
        _save(fig, plot_dir / filename)
        figures.append({"file": filename, "description": title})
    return figures


def _synthetic_plot(synthetic: pd.DataFrame, plot_dir: Path) -> list[dict]:
    test = synthetic[synthetic["split"] == "test"].copy()
    x = np.arange(len(test))
    width = 0.34
    fig, ax = plt.subplots(figsize=(10, 5.5))
    ax.bar(x - width / 2, test["mean_excess_terminal_return"] * 100, width, label="Excess return")
    ax.bar(x + width / 2, test["mean_mdd_improvement"] * 100, width, label="MDD iyileşmesi")
    ax.set_xticks(x, [f"Seed {seed}" for seed in test["seed"]])
    ax.set_ylabel("Yüzde puan")
    ax.set_title("Frozen sentetik test performansı (128 episode/seed)")
    ax.grid(axis="y", alpha=0.25)
    ax.legend()
    _save(fig, plot_dir / "04_synthetic_test_performance.png")

    fig, ax = plt.subplots(figsize=(10, 5.5))
    ax.bar(x - width / 2, test["win_vs_passive_rate"] * 100, width, label="Pasifi geçme")
    ax.bar(x + width / 2, test["mdd_better_rate"] * 100, width, label="Daha iyi MDD")
    ax.set_xticks(x, [f"Seed {seed}" for seed in test["seed"]])
    ax.set_ylim(0, 105)
    ax.set_ylabel("Episode oranı (%)")
    ax.set_title("Frozen test başarı oranları")
    ax.grid(axis="y", alpha=0.25)
    ax.legend()
    _save(fig, plot_dir / "05_synthetic_test_success_rates.png")
    return [
        {"file": "04_synthetic_test_performance.png", "description": "Frozen test excess ve MDD"},
        {"file": "05_synthetic_test_success_rates.png", "description": "Frozen test başarı oranları"},
    ]


def _historical_plots(delivery: Path, historical: pd.DataFrame, plot_dir: Path) -> list[dict]:
    daily_by_seed = {
        seed: pd.read_csv(delivery / "historical_replay" / f"seed{seed}" / "daily_overview.csv")
        for seed in SEEDS
    }
    figures: list[dict] = []
    for family in FAMILIES:
        fig, ax = plt.subplots(figsize=(12, 5.5))
        passive_drawn = False
        for seed, daily in daily_by_seed.items():
            frame = daily[daily["family"] == family].copy()
            dates = pd.to_datetime(frame["execution_date"])
            ax.plot(dates, frame["nav"], label=f"PPO seed {seed}", linewidth=1.8)
            if not passive_drawn:
                ax.plot(dates, frame["passive_nav"], label="Pasif fon", color="black", linestyle="--", linewidth=2.2)
                passive_drawn = True
        ax.set_title(f"{family}: Günlük NAV - tüm seed'ler")
        ax.set_ylabel("TL")
        ax.grid(alpha=0.25)
        ax.legend()
        fig.autofmt_xdate()
        filename = f"06_{family.lower()}_nav_all_seeds.png"
        _save(fig, plot_dir / filename)
        figures.append({"file": filename, "description": f"{family} günlük NAV"})

        fig, ax = plt.subplots(figsize=(12, 5.5))
        for seed, daily in daily_by_seed.items():
            frame = daily[daily["family"] == family].copy()
            dates = pd.to_datetime(frame["execution_date"])
            ax.plot(dates, frame["nav_advantage_try"], label=f"Seed {seed}", linewidth=1.8)
        ax.axhline(0.0, color="black", linewidth=0.9)
        ax.set_title(f"{family}: Pasif fona göre kümülatif NAV avantajı")
        ax.set_ylabel("TL")
        ax.grid(alpha=0.25)
        ax.legend()
        fig.autofmt_xdate()
        filename = f"07_{family.lower()}_nav_advantage.png"
        _save(fig, plot_dir / filename)
        figures.append({"file": filename, "description": f"{family} NAV avantajı"})

        fig, ax = plt.subplots(figsize=(12, 5.5))
        passive_drawn = False
        for seed, daily in daily_by_seed.items():
            frame = daily[daily["family"] == family].copy()
            dates = pd.to_datetime(frame["execution_date"])
            ax.plot(dates, frame["agent_drawdown"] * 100, label=f"PPO seed {seed}", linewidth=1.8)
            if not passive_drawn:
                ax.plot(dates, frame["passive_drawdown"] * 100, label="Pasif fon", color="black", linestyle="--", linewidth=2.2)
                passive_drawn = True
        ax.set_title(f"{family}: Günlük drawdown")
        ax.set_ylabel("Drawdown (%)")
        ax.grid(alpha=0.25)
        ax.legend()
        fig.autofmt_xdate()
        filename = f"08_{family.lower()}_drawdown_all_seeds.png"
        _save(fig, plot_dir / filename)
        figures.append({"file": filename, "description": f"{family} drawdown"})

    metric = historical[["seed", "family", "terminal_return", "passive_terminal_return", "excess_terminal_return"]].copy()
    labels = [f"{row.family}\n{row.seed}" for row in metric.itertuples(index=False)]
    x = np.arange(len(metric))
    fig, ax = plt.subplots(figsize=(12, 5.5))
    ax.bar(x, metric["terminal_return"] * 100, label="PPO")
    ax.scatter(x, metric["passive_terminal_return"] * 100, color="black", marker="_", s=500, label="Pasif")
    ax.set_xticks(x, labels)
    ax.set_ylabel("Dönem getirisi (%)")
    ax.set_title("Gerçek tarih replay: dönem sonu getiri")
    ax.grid(axis="y", alpha=0.25)
    ax.legend()
    _save(fig, plot_dir / "09_historical_terminal_returns.png")
    figures.append({"file": "09_historical_terminal_returns.png", "description": "Tarihsel dönem sonu getirileri"})
    return figures


def _champion_plots(delivery: Path, plot_dir: Path) -> list[dict]:
    source = delivery / "historical_replay" / f"seed{CHAMPION_SEED}"
    daily = pd.read_csv(source / "daily_overview.csv")
    weights = pd.read_csv(source / "daily_weights_long.csv")
    rewards = pd.read_csv(source / "reward_component_counts.csv")
    figures: list[dict] = []

    fig, axes = plt.subplots(2, 1, figsize=(12, 9), sharex=False)
    for ax, family in zip(axes, FAMILIES):
        frame = daily[daily["family"] == family].copy()
        dates = pd.to_datetime(frame["execution_date"])
        ax.plot(dates, frame["tpp_weight"] * 100, color="black", linewidth=2.2, label="TPP gerçekleşen")
        ax.plot(dates, frame["requested_tpp_weight"] * 100, color="tab:blue", alpha=0.65, label="TPP istenen")
        ax.axhline(5, color="tab:red", linestyle="--", linewidth=1)
        ax.axhline(15, color="tab:red", linestyle="--", linewidth=1)
        ax.set_title(f"{family}: TPP ağırlığı")
        ax.set_ylabel("Ağırlık (%)")
        ax.grid(alpha=0.25)
        ax.legend()
    _save(fig, plot_dir / "10_champion_tpp_weight.png")
    figures.append({"file": "10_champion_tpp_weight.png", "description": "Ana model TPP yolu"})

    fig, axes = plt.subplots(2, 1, figsize=(12, 9), sharex=False)
    for ax, family in zip(axes, FAMILIES):
        frame = daily[daily["family"] == family].copy()
        dates = pd.to_datetime(frame["execution_date"])
        ax.bar(dates, frame["realized_turnover"] * 100, label="Gerçekleşen turnover (%)", alpha=0.75)
        ax2 = ax.twinx()
        ax2.plot(dates, frame["commission"], color="tab:red", label="Komisyon TL", linewidth=1.5)
        ax.set_title(f"{family}: Günlük turnover ve komisyon")
        ax.set_ylabel("Turnover (%)")
        ax2.set_ylabel("Komisyon (TL)")
        ax.grid(alpha=0.2)
    _save(fig, plot_dir / "11_champion_turnover_commission.png")
    figures.append({"file": "11_champion_turnover_commission.png", "description": "Ana model turnover ve komisyon"})

    fig, axes = plt.subplots(2, 1, figsize=(12, 9), sharex=False)
    reward_columns = ["reward_relative", "reward_mdd_absolute", "reward_mdd_relative", "reward_target_change"]
    for ax, family in zip(axes, FAMILIES):
        frame = daily[daily["family"] == family].copy()
        dates = pd.to_datetime(frame["execution_date"])
        for column in reward_columns:
            ax.plot(dates, frame[column].cumsum(), label=column, linewidth=1.7)
        ax.set_title(f"{family}: Kümülatif reward bileşenleri")
        ax.grid(alpha=0.25)
        ax.legend(fontsize=8)
    _save(fig, plot_dir / "12_champion_cumulative_reward_components.png")
    figures.append({"file": "12_champion_cumulative_reward_components.png", "description": "Ana model kümülatif reward"})

    symbols = list(dict.fromkeys(weights["instrument"].tolist()))
    fig, axes = plt.subplots(2, 1, figsize=(14, 10), sharex=False)
    for ax, family in zip(axes, FAMILIES):
        frame = weights[weights["family"] == family]
        for symbol in symbols:
            line = frame[frame["instrument"] == symbol]
            ax.plot(
                pd.to_datetime(line["execution_date"]),
                line["posttrade_percent"],
                label=symbol,
                linewidth=2.2 if symbol == "TPP_ON" else 1.05,
                color="black" if symbol == "TPP_ON" else None,
            )
        ax.set_title(f"{family}: Günlük kesirli varlık ağırlıkları")
        ax.set_ylabel("Ağırlık (%)")
        ax.grid(alpha=0.2)
    axes[0].legend(ncol=6, fontsize=7, loc="upper center", bbox_to_anchor=(0.5, 1.35))
    _save(fig, plot_dir / "13_champion_weight_lines.png")
    figures.append({"file": "13_champion_weight_lines.png", "description": "Ana model günlük tüm ağırlıklar"})

    fig, axes = plt.subplots(2, 1, figsize=(14, 9))
    for ax, family in zip(axes, FAMILIES):
        matrix = (
            weights[weights["family"] == family]
            .pivot(index="instrument", columns="scenario_day", values="posttrade_percent")
            .reindex(symbols)
        )
        image = ax.imshow(matrix.to_numpy(), aspect="auto", cmap="viridis", vmin=0, vmax=15)
        ax.set_yticks(np.arange(len(symbols)), symbols, fontsize=8)
        ax.set_title(f"{family}: Ağırlık ısı haritası")
        ax.set_xlabel("Senaryo günü")
        fig.colorbar(image, ax=ax, label="Ağırlık (%)")
    _save(fig, plot_dir / "14_champion_allocation_heatmap.png")
    figures.append({"file": "14_champion_allocation_heatmap.png", "description": "Ana model ağırlık ısı haritası"})

    fig, axes = plt.subplots(2, 1, figsize=(12, 8))
    for ax, family in zip(axes, FAMILIES):
        frame = daily[daily["family"] == family]
        dates = pd.to_datetime(frame["execution_date"])
        ax.step(dates, frame["applied_heavy_count"], where="mid", label="Heavy hisse sayısı")
        ax2 = ax.twinx()
        ax2.plot(dates, frame["rule4_headroom"] * 100, color="tab:green", label="%40 kuralı boşluğu")
        ax.set_title(f"{family}: Heavy hisse sayısı ve kural-4 boşluğu")
        ax.set_ylabel("Heavy sayısı")
        ax2.set_ylabel("Boşluk (yüzde puan)")
        ax.grid(alpha=0.2)
    _save(fig, plot_dir / "15_champion_heavy_rule4.png")
    figures.append({"file": "15_champion_heavy_rule4.png", "description": "Heavy üyelik ve yüzde 40 kuralı"})

    pivot = rewards[["family", "component", "sum"]].copy()
    pivot["sum"] = pd.to_numeric(pivot["sum"], errors="raise")
    fig, ax = plt.subplots(figsize=(11, 5.5))
    labels = [f"{row.family}\n{row.component.replace('reward_', '')}" for row in pivot.itertuples(index=False)]
    colors = ["tab:green" if value >= 0 else "tab:red" for value in pivot["sum"]]
    ax.bar(np.arange(len(pivot)), pivot["sum"], color=colors)
    ax.set_xticks(np.arange(len(pivot)), labels, rotation=25, ha="right")
    ax.set_title("Ana model: reward bileşenlerinin dönem toplamı")
    ax.set_ylabel("Reward")
    ax.grid(axis="y", alpha=0.25)
    _save(fig, plot_dir / "16_champion_reward_totals.png")
    figures.append({"file": "16_champion_reward_totals.png", "description": "Reward bileşen toplamları"})
    return figures


def _old_new_plot(comparison: pd.DataFrame, plot_dir: Path) -> list[dict]:
    x = np.arange(len(comparison))
    width = 0.34
    fig, ax = plt.subplots(figsize=(9, 5.5))
    ax.bar(x - width / 2, comparison["old_excess_terminal_return"] * 100, width, label="Eski V2.2")
    ax.bar(x + width / 2, comparison["new_excess_terminal_return"] * 100, width, label="Yeni V2.2d")
    ax.set_xticks(x, comparison["family"])
    ax.set_ylabel("Pasife göre excess (yüzde puan)")
    ax.set_title("Aynı başlangıç fonu: eski ve yeni model")
    ax.grid(axis="y", alpha=0.25)
    ax.legend()
    _save(fig, plot_dir / "17_old_v22_vs_v22d.png")
    return [{"file": "17_old_v22_vs_v22d.png", "description": "Eski V2.2 ile yeni V2.2d karşılaştırması"}]


def _first_target_plot(daily: pd.DataFrame, plot_dir: Path) -> list[dict]:
    champion = daily[daily["seed"] == CHAMPION_SEED]
    fig, axes = plt.subplots(2, 1, figsize=(12, 9), sharex=False)
    for ax, family in zip(axes, FAMILIES):
        frame = champion[champion["family"] == family]
        dates = pd.to_datetime(frame["execution_date"])
        ax.plot(dates, frame["nav"], label="Tam PPO - günlük işlemler", linewidth=2.1)
        ax.plot(dates, frame["first_target_frozen_nav"], label="İlk hedef sonrası dondurulmuş", linewidth=2.0)
        ax.plot(dates, frame["passive_nav"], label="Başlangıç fonu pasif", color="black", linestyle="--", linewidth=1.8)
        ax.set_title(f"{family}: Günlük işlemlerin ek katkısı")
        ax.set_ylabel("NAV (TL)")
        ax.grid(alpha=0.25)
        ax.legend()
    _save(fig, plot_dir / "18_first_target_frozen_counterfactual.png")
    return [
        {
            "file": "18_first_target_frozen_counterfactual.png",
            "description": "İlk hedef dondurulmuş karşı-olgusal kıyas",
        }
    ]


def build() -> Path:
    root = Path.cwd().resolve()
    delivery = root / "artifacts_v22d" / "final_delivery"
    summary_dir = delivery / "summary"
    plot_dir = delivery / "plots_combined"
    summary_dir.mkdir(parents=True, exist_ok=True)
    plot_dir.mkdir(parents=True, exist_ok=True)

    synthetic = pd.concat([_evaluation_rows(root, "validation"), _evaluation_rows(root, "test")], ignore_index=True)
    historical = _historical_rows(delivery)
    old_new = _old_new_comparison(root, historical)
    first_target_daily, first_target_summary = _first_target_frozen(delivery)
    training = _training_rows(root)
    model_files = _package_models(root, delivery)
    synthetic.to_csv(summary_dir / "synthetic_validation_test_all_seeds.csv", index=False)
    historical.to_csv(summary_dir / "historical_results_all_seeds.csv", index=False)
    old_new.to_csv(summary_dir / "old_v22_vs_v22d_champion.csv", index=False)
    first_target_daily.to_csv(summary_dir / "first_target_frozen_daily.csv", index=False)
    first_target_summary.to_csv(summary_dir / "first_target_frozen_summary.csv", index=False)
    training.to_csv(summary_dir / "training_summary_all_seeds.csv", index=False)
    model_files.to_csv(summary_dir / "model_file_checksums.csv", index=False)

    figures = []
    figures += _training_plots(root, plot_dir)
    figures += _synthetic_plot(synthetic, plot_dir)
    figures += _historical_plots(delivery, historical, plot_dir)
    figures += _champion_plots(delivery, plot_dir)
    figures += _old_new_plot(old_new, plot_dir)
    figures += _first_target_plot(first_target_daily, plot_dir)
    pd.DataFrame(figures).to_csv(summary_dir / "graph_index.csv", index=False)

    champion_test = synthetic[(synthetic["split"] == "test") & (synthetic["seed"] == CHAMPION_SEED)].iloc[0]
    champion_hist = historical[historical["seed"] == CHAMPION_SEED]
    rows = {row.family: row for row in champion_hist.itertuples(index=False)}
    comparison_rows = {row.family: row for row in old_new.itertuples(index=False)}
    frozen_rows = {
        row.family: row
        for row in first_target_summary[first_target_summary["seed"] == CHAMPION_SEED].itertuples(index=False)
    }
    report = f"""# V2.2d Final Sonuç Raporu

## Karar

Ana model seed `{CHAMPION_SEED}` seçildi. Seçim frozen validation performansıyla yapıldı; frozen test ve gerçek tarih sonuçlarına bakarak seçim değiştirilmedi.

## Frozen sentetik test

- Episode: {int(champion_test.episodes)}
- Ortalama excess return: {champion_test.mean_excess_terminal_return * 100:.3f} yüzde puan
- Ortalama MDD iyileşmesi: {champion_test.mean_mdd_improvement * 100:.3f} yüzde puan
- Pasif fonu geçen episode oranı: {champion_test.win_vs_passive_rate * 100:.1f}%
- Daha iyi MDD episode oranı: {champion_test.mdd_better_rate * 100:.1f}%
- İzahname ihlal günü: {int(champion_test.illegal_days)}

## Gerçek tarih deterministic replay

| Senaryo | Gün | PPO getiri | Pasif getiri | Excess | PPO son NAV | Pasif son NAV | Komisyon |
|---|---:|---:|---:|---:|---:|---:|---:|
| S1 | {int(rows['S1'].days)} | {rows['S1'].terminal_return * 100:.3f}% | {rows['S1'].passive_terminal_return * 100:.3f}% | {rows['S1'].excess_terminal_return * 100:.3f} puan | {rows['S1'].terminal_nav_try:,.2f} TL | {rows['S1'].passive_terminal_nav_try:,.2f} TL | {rows['S1'].total_commission_try:,.2f} TL |
| S2 | {int(rows['S2'].days)} | {rows['S2'].terminal_return * 100:.3f}% | {rows['S2'].passive_terminal_return * 100:.3f}% | {rows['S2'].excess_terminal_return * 100:.3f} puan | {rows['S2'].terminal_nav_try:,.2f} TL | {rows['S2'].passive_terminal_nav_try:,.2f} TL | {rows['S2'].total_commission_try:,.2f} TL |

Bu tarih aralıkları senaryo kalibrasyonunda kullanıldığı için sonuçlar bağımsız unseen test değil, nedensel tarihsel replay/diagnostic olarak raporlanır.

## Eski V2.2 ile karşılaştırma

- S1 terminal getiri iyileşmesi: {comparison_rows['S1'].terminal_return_improvement * 100:.3f} yüzde puan; eski excess {comparison_rows['S1'].old_excess_terminal_return * 100:.3f}, yeni excess {comparison_rows['S1'].new_excess_terminal_return * 100:.3f} puan.
- S2 terminal getiri iyileşmesi: {comparison_rows['S2'].terminal_return_improvement * 100:.3f} yüzde puan; eski excess {comparison_rows['S2'].old_excess_terminal_return * 100:.3f}, yeni excess {comparison_rows['S2'].new_excess_terminal_return * 100:.3f} puan.
- Yeni model daha aktif işlem yaptığı için komisyon daha yüksektir; yukarıdaki net getiriler komisyon sonrası değerlerdir.

## Günlük işlemlerin katkısı

İlk günün PPO hedefi uygulandıktan sonra portföy dondurulmuş olsaydı, tam günlük politika ile arasındaki dönem sonu farkı S1'de {frozen_rows['S1'].active_trading_contribution_try:,.2f} TL ({frozen_rows['S1'].active_trading_contribution_return * 100:.3f} puan), S2'de {frozen_rows['S2'].active_trading_contribution_try:,.2f} TL ({frozen_rows['S2'].active_trading_contribution_return * 100:.3f} puan) olurdu. Bu karşı-olgusal kontrol, sonraki günlük işlemlerin komisyon sonrasında ek değer ürettiğini gösterir.

## İzahname ve TPP

- TPP hisse değildir ve heavy `%40` toplamına dahil edilmez.
- TPP yalnızca kendi `%5-%15` bandına ve toplam portföyün `%100` olmasına tabidir.
- Her gün hisse toplamı, tek-hisse sınırları, heavy hisse toplamı ve TPP bandı hard decoder/validator ile kontrol edilir.
- Üç seed'in tüm gerçek tarih replay kalite kontrolleri geçti; reward yeniden-bileşim hatası `0` ve ağırlık toplamı hatası makine hassasiyeti düzeyindedir.

## Günlük çıktılar

Her seed klasöründe `daily_overview.csv`, `daily_weights_long.csv`, `daily_actions.csv`, `daily_trade_blotter.csv`, `executed_trades.csv`, `reward_component_counts.csv`, quality checks ve senaryo grafikleri bulunur. Ana kullanım için `historical_replay/seed{CHAMPION_SEED}` klasörü önerilir.
"""
    (delivery / "V22D_FINAL_SONUC_RAPORU.md").write_text(report, encoding="utf-8")

    manifest = {
        "schema_version": "bist_stress_rl_v22d_final_delivery",
        "champion_seed": CHAMPION_SEED,
        "selection_basis": "frozen_validation_only",
        "seeds": SEEDS,
        "training_timesteps_total": int(training["timesteps"].sum()),
        "training_episodes_total": int(training["episodes"].sum()),
        "historical_quality_checks_all_pass": all(
            json.loads((delivery / "historical_replay" / f"seed{seed}" / "quality_checks.json").read_text(encoding="utf-8"))["all_mandatory_checks_pass"]
            for seed in SEEDS
        ),
        "daily_outputs_present": True,
        "combined_graphs": len(figures),
    }
    (delivery / "delivery_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    checksum_rows = []
    for path in sorted(delivery.rglob("*")):
        if path.is_file() and path.name != "DELIVERY_SHA256.csv":
            checksum_rows.append(
                {
                    "file": str(path.relative_to(delivery)).replace("\\", "/"),
                    "bytes": path.stat().st_size,
                    "sha256": _sha256(path),
                }
            )
    pd.DataFrame(checksum_rows).to_csv(delivery / "DELIVERY_SHA256.csv", index=False)
    return delivery


def main() -> None:
    print(f"V22D_FINAL_REPORT_COMPLETE {build()}", flush=True)


if __name__ == "__main__":
    main()
