from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from stable_baselines3 import PPO

from .config import load_config
from .constraints import ProspectusConstraints
from .data_v22 import V22MarketData
from .env_v22 import BistStressEnvV22
from .evaluate_v22 import reward_summary, run_episode, trade_blotter
from .historical_v22 import build_historical_path
from .runtime_v22 import RuntimeV22
from .scenarios_v22 import ScenarioLibraryV22


SCENARIO_CONTRACT: dict[str, dict[str, str]] = {
    "S1": {
        "label": "Imamoglu_tutuklandi",
        "warmup_start": "2025-02-14",
        "active_start": "2025-03-17",
        "active_end": "2025-05-05",
    },
    "S2": {
        "label": "CHP_mutlak_butlan",
        "warmup_start": "2025-07-28",
        "active_start": "2025-08-26",
        "active_end": "2025-10-17",
    },
}

DATA_FILES = {
    "equity_prices": "equity_prices.parquet",
    "fx_daily": "fx_daily.parquet",
    "tpp_overnight": "tpp_overnight_observed.parquet",
    "trading_calendar": "trading_calendar.parquet",
    "instrument_master": "instrument_master.parquet",
}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def _canonical_initial_weights(
    payload: dict[str, Any], symbols: list[str]
) -> dict[str, float]:
    aliases = {symbol.upper(): symbol for symbol in symbols}
    for symbol in symbols[:-1]:
        aliases[symbol.removesuffix(".E").upper()] = symbol
    aliases["TPP"] = symbols[-1]
    canonical: dict[str, float] = {}
    for raw_code, raw_weight in payload.items():
        code = str(raw_code).strip().upper()
        if code not in aliases:
            raise ValueError(f"Unknown initial-portfolio asset: {raw_code}")
        symbol = aliases[code]
        if symbol in canonical:
            raise ValueError(f"Duplicate initial-portfolio asset: {symbol}")
        text_weight = str(raw_weight).strip()
        explicit_percent = text_weight.endswith("%")
        if explicit_percent:
            text_weight = text_weight[:-1].strip()
        value = float(text_weight)
        if explicit_percent:
            value /= 100.0
        if not np.isfinite(value) or value < 0.0:
            raise ValueError(f"Invalid initial weight for {symbol}: {raw_weight}")
        canonical[symbol] = value
    missing = sorted(set(symbols) - set(canonical))
    if missing:
        raise ValueError(f"Initial portfolio is missing assets: {', '.join(missing)}")
    total = float(sum(canonical.values()))
    if np.isclose(total, 100.0, atol=1e-6):
        canonical = {symbol: value / 100.0 for symbol, value in canonical.items()}
        total = float(sum(canonical.values()))
    if not np.isclose(total, 1.0, atol=1e-8):
        raise ValueError(
            f"Initial weights must sum to 1.0 or 100.0; observed total is {total:.10f}"
        )
    return {symbol: float(canonical[symbol]) for symbol in symbols}


def _read_initial_weights(
    *,
    symbols: list[str],
    json_path: str | Path | None,
    csv_path: str | Path | None,
    inline_text: str | None,
    direct_payload: dict[str, Any] | None,
) -> dict[str, float] | None:
    supplied = sum(
        value is not None for value in (json_path, csv_path, inline_text, direct_payload)
    )
    if supplied > 1:
        raise ValueError("Use only one initial-portfolio input method")
    if json_path is not None:
        payload = json.loads(Path(json_path).read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("Initial-weight JSON must be an asset-to-weight object")
        return _canonical_initial_weights(payload, symbols)
    if csv_path is not None:
        frame = pd.read_csv(csv_path)
        required = {"asset_code", "weight"}
        if not required.issubset(frame.columns):
            raise ValueError("Initial-portfolio CSV requires asset_code and weight columns")
        if frame.empty:
            raise ValueError("Initial-portfolio CSV is empty")
        payload = dict(zip(frame["asset_code"], frame["weight"], strict=True))
        if len(payload) != len(frame):
            raise ValueError("Initial-portfolio CSV contains duplicate asset_code rows")
        return _canonical_initial_weights(payload, symbols)
    if inline_text is not None:
        entries = [entry.strip() for entry in inline_text.replace(",", ";").split(";")]
        entries = [entry for entry in entries if entry]
        payload: dict[str, str] = {}
        for entry in entries:
            if "=" not in entry:
                raise ValueError(
                    f"Invalid inline weight '{entry}'; expected ASSET=WEIGHT"
                )
            code, weight = entry.split("=", 1)
            code = code.strip()
            if not code or code in payload:
                raise ValueError(f"Invalid or duplicate inline asset: {code}")
            payload[code] = weight.strip()
        return _canonical_initial_weights(payload, symbols)
    if direct_payload is not None:
        return _canonical_initial_weights(direct_payload, symbols)
    return None


def _prompt_initial_portfolio(
    config_path: str | Path,
    supplied_nav: float | None,
) -> tuple[float, dict[str, str]]:
    config = load_config(config_path)
    symbols = list(config["universe"]["tickers"]) + [config["universe"]["tpp_symbol"]]
    default_nav = float(config["project"]["initial_nav_try"])
    if supplied_nav is None:
        raw_nav = input(f"Başlangıç portföy büyüklüğü TL [{default_nav:.2f}]: ").strip()
        nav = float(raw_nav) if raw_nav else default_nav
    else:
        nav = float(supplied_nav)
        print(f"Başlangıç portföy büyüklüğü: {nav:,.2f} TL", flush=True)
    payload: dict[str, str] = {}
    print("Ağırlıkları yüzde olarak girin. Örnek: 5.73", flush=True)
    for symbol in symbols:
        default_percent = float(config["universe"]["initial_weights"][symbol]) * 100.0
        raw = input(f"{symbol} ağırlığı % [{default_percent:.4f}]: ").strip()
        payload[symbol] = f"{raw if raw else default_percent}%"
    return nav, payload


def _load_runtime(
    config_path: str | Path,
    *,
    data_root: str | Path | None,
    initial_nav_try: float | None,
    initial_weights_json: str | Path | None,
    initial_portfolio_csv: str | Path | None,
    initial_weights_inline: str | None,
    initial_weights_payload: dict[str, Any] | None,
) -> RuntimeV22:
    config = load_config(config_path)
    if data_root is not None:
        root = Path(data_root).resolve()
        if not root.is_dir():
            raise FileNotFoundError(f"Data root does not exist: {root}")
        for key, filename in DATA_FILES.items():
            candidate = root / filename
            if not candidate.is_file():
                raise FileNotFoundError(f"Required input is missing: {candidate}")
            config["paths"][key] = str(candidate)
    for key in DATA_FILES:
        candidate = Path(config["paths"][key])
        if not candidate.is_file():
            raise FileNotFoundError(f"Configured input is missing: {candidate}")

    if initial_nav_try is not None:
        if not np.isfinite(initial_nav_try) or float(initial_nav_try) <= 0.0:
            raise ValueError("initial_nav_try must be positive and finite")
        config["project"]["initial_nav_try"] = float(initial_nav_try)

    symbols = list(config["universe"]["tickers"]) + [config["universe"]["tpp_symbol"]]
    custom_weights = _read_initial_weights(
        symbols=symbols,
        json_path=initial_weights_json,
        csv_path=initial_portfolio_csv,
        inline_text=initial_weights_inline,
        direct_payload=initial_weights_payload,
    )
    if custom_weights is not None:
        config["universe"]["initial_weights"] = custom_weights
    initial_weights = [config["universe"]["initial_weights"][symbol] for symbol in symbols]
    ProspectusConstraints(config["constraints"], len(symbols) - 1).require(initial_weights)

    market = V22MarketData.from_config(config)
    scenarios = ScenarioLibraryV22(config, market)
    return RuntimeV22(config=config, market=market, scenarios=scenarios)


def _resolve_model_seed(model_path: Path, override: int | None, config: dict) -> tuple[int, str]:
    if override is not None:
        return int(override), "cli_override"
    candidates = [
        model_path.parent / "run_manifest.json",
        model_path.parent.parent / "run_manifest.json",
        model_path.parent / "deployment_manifest.json",
    ]
    for candidate in candidates:
        if not candidate.is_file():
            continue
        payload = json.loads(candidate.read_text(encoding="utf-8"))
        for key in ("model_seed", "seed", "deployment_seed"):
            if key in payload:
                return int(payload[key]), str(candidate)
        if isinstance(payload.get("deployment"), dict) and "seed" in payload["deployment"]:
            return int(payload["deployment"]["seed"]), str(candidate)
    return int(config["project"]["random_seed"]), "config_project_random_seed"


def _validate_scenario_contract(config: dict, families: Iterable[str]) -> None:
    for family in families:
        if family not in SCENARIO_CONTRACT:
            raise ValueError(f"Unsupported fixed scenario: {family}")
        configured = config["data"]["events"][family]
        expected = SCENARIO_CONTRACT[family]
        for key in ("active_start", "active_end"):
            if str(configured[key]) != expected[key]:
                raise ValueError(
                    f"{family} {key} changed: expected {expected[key]}, got {configured[key]}"
                )


def _custom_scenario_contract(
    runtime: RuntimeV22,
    family: str,
    active_start: str,
    active_end: str,
) -> dict[str, str]:
    start = pd.Timestamp(active_start)
    end = pd.Timestamp(active_end)
    if pd.isna(start) or pd.isna(end):
        raise ValueError("Custom start/end dates must be valid ISO dates")
    if start > end:
        raise ValueError("Custom start date must not be after end date")
    selected = np.flatnonzero(
        (runtime.market.return_dates >= np.datetime64(start.date()))
        & (runtime.market.return_dates <= np.datetime64(end.date()))
    )
    if len(selected) == 0:
        raise ValueError("Custom interval has no trading sessions in the local parquet data")
    first = int(selected[0])
    lookback = int(runtime.config["data"]["lookback_sessions"])
    if first < lookback:
        raise ValueError(f"Custom interval needs at least {lookback} prior return sessions")
    warmup_start = pd.Timestamp(runtime.market.dates[first - lookback]).strftime("%Y-%m-%d")
    return {
        "label": f"CUSTOM_{family}_{start:%Y%m%d}_{end:%Y%m%d}",
        "warmup_start": warmup_start,
        "active_start": pd.Timestamp(runtime.market.return_dates[selected[0]]).strftime("%Y-%m-%d"),
        "active_end": pd.Timestamp(runtime.market.return_dates[selected[-1]]).strftime("%Y-%m-%d"),
        "requested_start": start.strftime("%Y-%m-%d"),
        "requested_end": end.strftime("%Y-%m-%d"),
    }


def _daily_overview(daily: pd.DataFrame, initial_nav: float) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for (_, _), group in daily.groupby(["model_seed", "family"], sort=False):
        frame = group.sort_values("scenario_day").copy()
        passive_previous = frame["passive_nav"].shift(1).fillna(float(initial_nav))
        frame["agent_daily_pnl_try"] = frame["nav"] - frame["nav_previous"]
        frame["passive_daily_pnl_try"] = frame["passive_nav"] - passive_previous
        frame["agent_return_from_start"] = frame["nav"] / float(initial_nav) - 1.0
        frame["passive_return_from_start"] = frame["passive_nav"] / float(initial_nav) - 1.0
        frame["nav_advantage_try"] = frame["nav"] - frame["passive_nav"]
        frame["return_advantage"] = (
            frame["agent_return_from_start"] - frame["passive_return_from_start"]
        )
        frames.append(frame)
    combined = pd.concat(frames, ignore_index=True)
    columns = [
        "model_id",
        "model_seed",
        "family",
        "scenario_day",
        "information_cutoff",
        "execution_date",
        "stress_active",
        "decoded_status",
        "nav_previous",
        "nav_pre_trade",
        "nav",
        "passive_nav",
        "agent_daily_pnl_try",
        "passive_daily_pnl_try",
        "agent_return_from_start",
        "passive_return_from_start",
        "nav_advantage_try",
        "return_advantage",
        "agent_drawdown",
        "passive_drawdown",
        "target_change_turnover",
        "maintenance_turnover",
        "realized_turnover",
        "commission",
        "reward_relative",
        "reward_mdd_absolute",
        "reward_mdd_relative",
        "reward_target_change",
        "reward",
        "equity_sum",
        "tpp_weight",
        "applied_heavy_count",
        "heavy_sum",
        "rule4_headroom",
        "post_trade_legal",
        "post_trade_violations",
    ]
    dynamic_decoder_columns = [
        "decoder_reason_primary",
        "decoder_no_change_applied",
        "decoder_geometry_clip",
        "execution_tier",
        "requested_tpp_weight",
        "applied_tpp_weight",
        "requested_heavy_count",
        "target_budget",
        "target_budget_saturated",
        "heavy_switches",
        "membership_flips",
    ]
    insertion = columns.index("nav_previous")
    for name in reversed(dynamic_decoder_columns):
        if name in combined.columns and name not in columns:
            columns.insert(insertion, name)
    return combined[columns]


def _daily_actions(daily: pd.DataFrame, tickers: list[str]) -> pd.DataFrame:
    action_matrix = np.vstack(daily["raw_action"].to_numpy()).astype(np.float64)
    dynamic = bool(
        "action_version" in daily.columns
        and daily["action_version"].astype(str).eq("action_v22d_absolute").all()
    )
    names = [
        "raw_action_tpp_absolute" if dynamic else "raw_action_tpp_delta",
        "raw_action_heavy_count_preference" if dynamic else "raw_action_heavy_count_delta",
    ] + [
        f"raw_action_tilt_{ticker}" for ticker in tickers
    ]
    actions = pd.DataFrame(action_matrix, columns=names, index=daily.index)
    identity_columns = [
            "model_seed",
            "family",
            "scenario_day",
            "information_cutoff",
            "execution_date",
            "decoded_status",
            "target_budget",
            "target_budget_saturated",
            "requested_heavy_count",
            "applied_heavy_count",
            "heavy_switches",
    ]
    identity_columns.extend(
        name
        for name in [
            "decoder_reason_primary",
            "decoder_no_change_applied",
            "decoder_geometry_clip",
            "execution_tier",
            "requested_tpp_weight",
            "applied_tpp_weight",
            "membership_flips",
        ]
        if name in daily.columns
    )
    identity = daily[identity_columns].reset_index(drop=True)
    return pd.concat([identity, actions.reset_index(drop=True)], axis=1)


def _weights_long(daily: pd.DataFrame, symbols: list[str]) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    identity = [
        "model_seed",
        "family",
        "scenario_day",
        "information_cutoff",
        "execution_date",
        "nav",
        "passive_nav",
        "post_trade_legal",
    ]
    for symbol in symbols:
        frame = daily[identity].copy()
        frame["instrument"] = symbol
        frame["asset_type"] = "TPP" if symbol == symbols[-1] else "EQUITY"
        frame["price"] = daily[f"price_t_{symbol}"].to_numpy(dtype=float)
        frame["units"] = daily[f"units_after_{symbol}"].to_numpy(dtype=float)
        frame["value_try"] = daily[f"value_after_{symbol}"].to_numpy(dtype=float)
        frame["previous_target_weight"] = daily[f"previous_target_{symbol}"].to_numpy(dtype=float)
        frame["committed_target_weight"] = daily[f"target_weight_{symbol}"].to_numpy(dtype=float)
        frame["posttrade_weight"] = daily[f"weight_{symbol}"].to_numpy(dtype=float)
        frame["passive_weight"] = daily[f"passive_weight_{symbol}"].to_numpy(dtype=float)
        frame["committed_target_percent"] = frame["committed_target_weight"] * 100.0
        frame["posttrade_percent"] = frame["posttrade_weight"] * 100.0
        frame["passive_percent"] = frame["passive_weight"] * 100.0
        frame["net_trade_try"] = daily[f"trade_try_{symbol}"].to_numpy(dtype=float)
        frame["buy_try"] = daily[f"buy_try_{symbol}"].to_numpy(dtype=float)
        frame["sell_try"] = daily[f"sell_try_{symbol}"].to_numpy(dtype=float)
        frame["commission_try"] = daily[f"commission_try_{symbol}"].to_numpy(dtype=float)
        frame["side"] = np.select(
            [frame["net_trade_try"] > 1e-9, frame["net_trade_try"] < -1e-9],
            ["BUY", "SELL"],
            default="HOLD",
        )
        frame["executed"] = frame["net_trade_try"].abs() > 1e-9
        frames.append(frame)
    return pd.concat(frames, ignore_index=True)


def _print_daily_portfolio(
    daily: pd.DataFrame,
    symbols: list[str],
    initial_nav: float,
    initial_weights: dict[str, float],
) -> None:
    print("DAILY_PORTFOLIO_BEGIN", flush=True)
    starting_weights = " | ".join(
        f"{symbol}={float(initial_weights[symbol]) * 100.0:.4f}%" for symbol in symbols
    )
    print(
        f"INITIAL | NAV={float(initial_nav):,.2f} TL | {starting_weights}",
        flush=True,
    )
    for _, row in daily.sort_values(["family", "scenario_day"]).iterrows():
        weights = " | ".join(
            f"{symbol}={float(row[f'weight_{symbol}']) * 100.0:.4f}%"
            for symbol in symbols
        )
        print(
            f"DAY | {row['family']} | {row['execution_date']} | "
            f"NAV={float(row['nav']):,.2f} TL | "
            f"PASSIVE_NAV={float(row['passive_nav']):,.2f} TL | "
            f"{weights}",
            flush=True,
        )
    print("DAILY_PORTFOLIO_END", flush=True)


def _print_run_summary(metrics: pd.DataFrame) -> None:
    print("RUN_SUMMARY_BEGIN", flush=True)
    for row in metrics.itertuples(index=False):
        passive_advantage = float(row.terminal_nav_try) - float(row.passive_terminal_nav_try)
        print(
            f"RUN_SUMMARY | {row.family} | "
            f"INITIAL_NAV={float(row.initial_nav_try):,.2f} TL | "
            f"FINAL_NAV={float(row.terminal_nav_try):,.2f} TL | "
            f"NAV_CHANGE={float(row.terminal_profit_loss_try):+,.2f} TL | "
            f"RETURN={float(row.terminal_return) * 100.0:+.4f}% | "
            f"PASSIVE_FINAL_NAV={float(row.passive_terminal_nav_try):,.2f} TL | "
            f"VS_PASSIVE={passive_advantage:+,.2f} TL | "
            f"TOTAL_REWARD={float(row.total_reward):+.6f}",
            flush=True,
        )
    print("RUN_SUMMARY_END", flush=True)


def _quality_checks(
    config: dict,
    paths: list[Any],
    metrics: pd.DataFrame,
    daily: pd.DataFrame,
    actions: pd.DataFrame,
    symbols: list[str],
    scenario_contracts: dict[str, dict[str, str]],
) -> dict[str, Any]:
    date_checks: dict[str, bool] = {}
    for path in paths:
        expected = scenario_contracts[path.family]
        date_checks[path.family] = bool(
            path.dates[0] == expected["active_start"]
            and path.dates[-1] == expected["active_end"]
        )
    information = pd.to_datetime(daily["information_cutoff"], errors="raise")
    execution = pd.to_datetime(daily["execution_date"], errors="raise")
    weight_columns = [f"weight_{symbol}" for symbol in symbols]
    target_columns = [f"target_weight_{symbol}" for symbol in symbols]
    reward_sum = daily[
        ["reward_relative", "reward_mdd_absolute", "reward_mdd_relative", "reward_target_change"]
    ].sum(axis=1)
    checks: dict[str, Any] = {
        "scenario_dates_exact": date_checks,
        "all_information_cutoffs_precede_execution": bool((information < execution).all()),
        "warmup_return_sessions": int(config["data"]["lookback_sessions"]),
        "warmup_close_observations": int(config["data"]["warmup_closes"]),
        "all_agent_days_prospectus_legal": bool(daily["post_trade_legal"].astype(bool).all()),
        "illegal_agent_days": int((~daily["post_trade_legal"].astype(bool)).sum()),
        "max_weight_sum_error": float(
            np.max(np.abs(daily[weight_columns].sum(axis=1).to_numpy(dtype=float) - 1.0))
        ),
        "max_target_sum_error": float(
            np.max(np.abs(daily[target_columns].sum(axis=1).to_numpy(dtype=float) - 1.0))
        ),
        "max_reward_recomposition_error": float(
            np.max(np.abs(daily["reward"].to_numpy(dtype=float) - reward_sum.to_numpy(dtype=float)))
        ),
        "all_actions_finite": bool(
            np.isfinite(actions.select_dtypes(include=[np.number]).to_numpy()).all()
        ),
        "fractional_target_weights_observed": bool(
            np.any(
                np.abs(
                    daily[target_columns].to_numpy(dtype=float) * 100.0
                    - np.round(daily[target_columns].to_numpy(dtype=float) * 100.0)
                )
                > 1e-5
            )
        ),
        "episodes": int(len(metrics)),
        "days": {str(row.family): int(row.days) for row in metrics.itertuples(index=False)},
    }
    checks["all_mandatory_checks_pass"] = bool(
        all(date_checks.values())
        and checks["all_information_cutoffs_precede_execution"]
        and checks["all_agent_days_prospectus_legal"]
        and checks["max_weight_sum_error"] <= 1e-8
        and checks["max_target_sum_error"] <= 1e-8
        and checks["max_reward_recomposition_error"] <= 1e-10
        and checks["all_actions_finite"]
        and checks["fractional_target_weights_observed"]
    )
    return checks


def _plots(
    output: Path,
    daily: pd.DataFrame,
    weights: pd.DataFrame,
    trades: pd.DataFrame,
    symbols: list[str],
) -> None:
    plot_dir = output / "plots"
    plot_dir.mkdir(parents=True, exist_ok=True)
    for family, group in daily.groupby("family", sort=False):
        frame = group.sort_values("scenario_day")
        dates = pd.to_datetime(frame["execution_date"])

        fig, ax = plt.subplots(figsize=(11, 5))
        ax.plot(dates, frame["nav"], label="PPO ajan", linewidth=2)
        ax.plot(dates, frame["passive_nav"], label="Pasif fon", linewidth=2)
        ax.set_title(f"{family}: Günlük NAV")
        ax.set_ylabel("TL")
        ax.grid(alpha=0.25)
        ax.legend()
        fig.autofmt_xdate()
        fig.tight_layout()
        fig.savefig(plot_dir / f"{family.lower()}_nav.png", dpi=170)
        plt.close(fig)

        family_weights = weights[weights["family"] == family]
        matrix = (
            family_weights.pivot(index="instrument", columns="scenario_day", values="posttrade_percent")
            .reindex(symbols)
            .to_numpy(dtype=float)
        )
        fig, ax = plt.subplots(figsize=(13, 7))
        image = ax.imshow(matrix, aspect="auto", cmap="viridis", vmin=0.0, vmax=10.0)
        ax.set_yticks(np.arange(len(symbols)), labels=symbols)
        ax.set_xlabel("Senaryo işlem günü")
        ax.set_title(f"{family}: Günlük gerçekleşen ağırlıklar (%)")
        fig.colorbar(image, ax=ax, label="Ağırlık (%)")
        fig.tight_layout()
        fig.savefig(plot_dir / f"{family.lower()}_allocation_heatmap.png", dpi=170)
        plt.close(fig)

        family_trades = trades[(trades["family"] == family) & trades["executed"]]
        turnover = family_trades.groupby("scenario_day", as_index=False).agg(
            buy_try=("buy_try", "sum"),
            sell_try=("sell_try", "sum"),
            commission_try=("commission_try", "sum"),
        )
        fig, ax = plt.subplots(figsize=(11, 5))
        ax.bar(turnover["scenario_day"], turnover["buy_try"], label="Alım TL", alpha=0.7)
        ax.bar(
            turnover["scenario_day"],
            -turnover["sell_try"],
            label="Satım TL",
            alpha=0.7,
        )
        ax.set_title(f"{family}: Günlük alım/satım")
        ax.set_xlabel("Senaryo işlem günü")
        ax.set_ylabel("TL")
        ax.grid(alpha=0.2)
        ax.legend()
        fig.tight_layout()
        fig.savefig(plot_dir / f"{family.lower()}_trades.png", dpi=170)
        plt.close(fig)

        fig, ax = plt.subplots(figsize=(11, 5))
        for column in (
            "reward_relative",
            "reward_mdd_absolute",
            "reward_mdd_relative",
            "reward_target_change",
        ):
            ax.plot(dates, frame[column], label=column)
        ax.set_title(f"{family}: Günlük reward bileşenleri")
        ax.grid(alpha=0.25)
        ax.legend(fontsize=8)
        fig.autofmt_xdate()
        fig.tight_layout()
        fig.savefig(plot_dir / f"{family.lower()}_reward_components.png", dpi=170)
        plt.close(fig)


def run_fixed_scenario_inference(
    config_path: str | Path,
    model_path: str | Path,
    *,
    output_dir: str | Path | None = None,
    families: Iterable[str] = ("S1", "S2"),
    data_root: str | Path | None = None,
    initial_nav_try: float | None = None,
    initial_weights_json: str | Path | None = None,
    initial_portfolio_csv: str | Path | None = None,
    initial_weights_inline: str | None = None,
    initial_weights_payload: dict[str, Any] | None = None,
    model_seed: int | None = None,
    make_plots: bool = True,
    active_start: str | None = None,
    active_end: str | None = None,
    print_daily_console: bool = False,
    print_console_summary: bool = False,
) -> Path:
    family_list = [str(family).upper() for family in families]
    if not family_list or len(set(family_list)) != len(family_list):
        raise ValueError("At least one unique scenario family is required")
    runtime = _load_runtime(
        config_path,
        data_root=data_root,
        initial_nav_try=initial_nav_try,
        initial_weights_json=initial_weights_json,
        initial_portfolio_csv=initial_portfolio_csv,
        initial_weights_inline=initial_weights_inline,
        initial_weights_payload=initial_weights_payload,
    )
    config = runtime.config
    custom_interval = active_start is not None or active_end is not None
    if custom_interval:
        if active_start is None or active_end is None:
            raise ValueError("Both active_start and active_end are required for a custom interval")
        if len(family_list) != 1:
            raise ValueError("A custom interval requires exactly one scenario family: S1 or S2")
        scenario_contracts = {
            family_list[0]: _custom_scenario_contract(
                runtime, family_list[0], active_start, active_end
            )
        }
    else:
        _validate_scenario_contract(config, family_list)
        scenario_contracts = {family: SCENARIO_CONTRACT[family] for family in family_list}

    model_file = Path(model_path).resolve()
    if not model_file.is_file():
        raise FileNotFoundError(f"Model does not exist: {model_file}")
    resolved_seed, seed_source = _resolve_model_seed(model_file, model_seed, config)
    model = PPO.load(model_file, device=config["ppo"]["device"])
    expected_observation = (int(config["observation"]["dimension"]),)
    expected_action = (int(config["action"]["raw_dimension"]),)
    if model.observation_space.shape != expected_observation:
        raise ValueError(
            f"Model observation space {model.observation_space.shape} != {expected_observation}"
        )
    if model.action_space.shape != expected_action:
        raise ValueError(f"Model action space {model.action_space.shape} != {expected_action}")

    if output_dir is None:
        output = (
            Path(config["paths"]["artifacts_dir"])
            / "inference_runs"
            / (
                f"custom_{family_list[0].lower()}_{active_start}_{active_end}_{datetime.now():%Y%m%d_%H%M%S}"
                if custom_interval
                else f"fixed_{'_'.join(family_list).lower()}_{datetime.now():%Y%m%d_%H%M%S}"
            )
        )
    else:
        output = Path(output_dir).resolve()
    output.mkdir(parents=True, exist_ok=False)

    paths = [
        build_historical_path(
            runtime,
            family,
            active_start=active_start if custom_interval else None,
            active_end=active_end if custom_interval else None,
        )
        for family in family_list
    ]
    env = BistStressEnvV22(config, runtime.scenarios, split="test")
    metric_rows: list[dict[str, Any]] = []
    daily_frames: list[pd.DataFrame] = []
    try:
        for path in paths:
            metrics, daily = run_episode(model, env, path, resolved_seed)
            contract = scenario_contracts[path.family]
            metrics.update(
                {
                    "scenario_label": contract["label"],
                    "active_start": contract["active_start"],
                    "active_end": contract["active_end"],
                    "configured_warmup_start": contract["warmup_start"],
                    "warmup_return_sessions": int(path.lookback),
                    "warmup_close_observations": int(path.lookback + 1),
                }
            )
            daily.insert(4, "scenario_label", contract["label"])
            metric_rows.append(metrics)
            daily_frames.append(daily)
    finally:
        env.close()

    metrics = pd.DataFrame(metric_rows)
    daily = pd.concat(daily_frames, ignore_index=True)
    symbols = list(config["universe"]["tickers"]) + [config["universe"]["tpp_symbol"]]
    actions = _daily_actions(daily, list(config["universe"]["tickers"]))
    overview = _daily_overview(daily, float(config["project"]["initial_nav_try"]))
    weights = _weights_long(daily, symbols)
    trades = trade_blotter(daily, symbols)
    rewards = reward_summary(daily)
    quality = _quality_checks(
        config, paths, metrics, daily, actions, symbols, scenario_contracts
    )
    if not quality["all_mandatory_checks_pass"]:
        raise RuntimeError(f"Inference quality checks failed: {quality}")

    metrics.to_csv(output / "scenario_summary.csv", index=False)
    metrics.to_parquet(output / "scenario_summary.parquet", index=False)
    daily.to_parquet(output / "daily_portfolio_full.parquet", index=False)
    daily.to_csv(output / "daily_portfolio_full.csv.gz", index=False, compression="gzip")
    overview.to_csv(output / "daily_overview.csv", index=False)
    actions.to_csv(output / "daily_actions.csv", index=False)
    weights.to_parquet(output / "daily_weights_long.parquet", index=False)
    weights.to_csv(output / "daily_weights_long.csv", index=False)
    trades.to_parquet(output / "daily_trade_blotter.parquet", index=False)
    trades.to_csv(output / "daily_trade_blotter.csv", index=False)
    trades[trades["executed"]].to_csv(output / "executed_trades.csv", index=False)
    rewards.to_csv(output / "reward_component_counts.csv", index=False)
    _write_json(output / "quality_checks.json", quality)

    if make_plots:
        _plots(output, daily, weights, trades, symbols)
    if print_daily_console:
        _print_daily_portfolio(
            daily,
            symbols,
            float(config["project"]["initial_nav_try"]),
            config["universe"]["initial_weights"],
        )
    if print_console_summary:
        _print_run_summary(metrics)

    input_hashes = {
        key: {
            "path": str(Path(config["paths"][key]).resolve()),
            "sha256": _sha256(Path(config["paths"][key]).resolve()),
        }
        for key in DATA_FILES
    }
    manifest = {
        "schema_version": "bist_stress_rl_v22_fixed_scenario_inference",
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "method": "deterministic_historical_scenario_inference_replay",
        "model_id": config["model"]["id"],
        "model_path": str(model_file),
        "model_sha256": _sha256(model_file),
        "model_seed": int(resolved_seed),
        "model_seed_source": seed_source,
        "config_path": str(Path(config_path).resolve()),
        "config_sha256": _sha256(Path(config_path).resolve()),
        "state_dimension": int(config["observation"]["dimension"]),
        "action_dimension": int(config["action"]["raw_dimension"]),
        "deterministic_policy": True,
        "scenario_information_supplied_to_agent": True,
        "exact_remaining_horizon_supplied": False,
        "decision_contract": config["project"]["execution"],
        "warmup_return_sessions": int(config["data"]["lookback_sessions"]),
        "warmup_close_observations": int(config["data"]["warmup_closes"]),
        "initial_nav_try": float(config["project"]["initial_nav_try"]),
        "initial_weights": config["universe"]["initial_weights"],
        "families": scenario_contracts,
        "custom_interval": bool(custom_interval),
        "input_data": input_hashes,
        "no_yahoo_finance": True,
        "quality_checks": quality,
        "methodological_note": (
            "These event periods informed scenario calibration; this replay is a deterministic "
            "scenario diagnostic, not a fully independent unseen test."
        ),
    }
    _write_json(output / "inference_manifest.json", manifest)

    readme = [
        "# Tarihsel Senaryo Inference Çıktısı",
        "",
        "Model her işlem gününde yalnızca information_cutoff tarihinde bilinen state ile karar verir;",
        "işlem execution_date kapanış hedefi olarak uygulanır. S1/S2 senaryo kimliği modele haricen verilir,",
        "tam kalan gün sayısı verilmez. Ağırlıklar kesirlidir ve izahname hard decoder ile uygulanır.",
        "",
        "## Ana dosyalar",
        "- daily_overview.csv: gün gün NAV, pasif karşılaştırması, komisyon, reward ve kısıt özeti",
        "- daily_weights_long.csv: her gün ve her varlık için sayısal ağırlık/değer/işlem",
        "- executed_trades.csv: yalnızca gerçekleşen alım-satımlar",
        "- daily_actions.csv: PPO raw action değerleri ve decoder sonucu",
        "- scenario_summary.csv: iki dönem terminal performansı",
        "- quality_checks.json: nedensellik ve izahname kontrolleri",
        "- inference_manifest.json: model/veri hash'leri ve çalışma sözleşmesi",
    ]
    (output / "README.md").write_text("\n".join(readme) + "\n", encoding="utf-8")

    checksums = {
        str(path.relative_to(output)).replace("\\", "/"): _sha256(path)
        for path in output.rglob("*")
        if path.is_file() and path.name != "output_checksums.json"
    }
    _write_json(output / "output_checksums.json", checksums)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the packaged P1 PPO on fixed or custom historical intervals."
    )
    parser.add_argument("--config", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output-dir")
    parser.add_argument("--scenario", choices=["S1", "S2", "both"], default="both")
    parser.add_argument("--data-root")
    parser.add_argument("--initial-nav-try", type=float)
    initial_group = parser.add_mutually_exclusive_group()
    initial_group.add_argument("--initial-weights-json")
    initial_group.add_argument("--initial-portfolio-csv")
    initial_group.add_argument(
        "--initial-weights",
        help="Inline ASSET=WEIGHT pairs separated with semicolons",
    )
    initial_group.add_argument("--interactive-portfolio", action="store_true")
    parser.add_argument("--model-seed", type=int)
    parser.add_argument("--no-plots", action="store_true")
    parser.add_argument("--start-date", help="Custom interval start, YYYY-MM-DD")
    parser.add_argument("--end-date", help="Custom interval end, YYYY-MM-DD")
    parser.add_argument(
        "--quiet-daily-console",
        action="store_true",
        help="Do not print one NAV/weight line for every execution day",
    )
    args = parser.parse_args()
    interactive_payload = None
    if args.interactive_portfolio:
        args.initial_nav_try, interactive_payload = _prompt_initial_portfolio(
            args.config, args.initial_nav_try
        )
    families = ("S1", "S2") if args.scenario == "both" else (args.scenario,)
    output = run_fixed_scenario_inference(
        args.config,
        args.model,
        output_dir=args.output_dir,
        families=families,
        data_root=args.data_root,
        initial_nav_try=args.initial_nav_try,
        initial_weights_json=args.initial_weights_json,
        initial_portfolio_csv=args.initial_portfolio_csv,
        initial_weights_inline=args.initial_weights,
        initial_weights_payload=interactive_payload,
        model_seed=args.model_seed,
        make_plots=not args.no_plots,
        active_start=args.start_date,
        active_end=args.end_date,
        print_daily_console=not args.quiet_daily_console,
        print_console_summary=True,
    )
    print(f"V22_FIXED_SCENARIO_INFERENCE_COMPLETE {output}", flush=True)


if __name__ == "__main__":
    main()
