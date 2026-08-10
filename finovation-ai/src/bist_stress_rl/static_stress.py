from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from .portfolio import PortfolioBook
from .runtime import Runtime, build_runtime


def build_static_outputs(runtime: Runtime) -> Path:
    cfg = runtime.config
    output_dir = Path(cfg["paths"]["outputs_dir"]) / "static_stress"
    output_dir.mkdir(parents=True, exist_ok=True)
    symbols = list(cfg["universe"]["tickers"]) + [cfg["universe"]["tpp_symbol"]]
    initial_map = cfg["universe"]["initial_weights"]
    initial_weights = np.asarray([initial_map[symbol] for symbol in symbols], dtype=np.float64)
    summary_rows: list[dict] = []
    asset_rows: list[dict] = []
    daily_rows: list[dict] = []
    initial_nav = float(cfg["project"]["initial_nav_try"])

    for family in runtime.scenarios.families:
        path = runtime.scenarios.canonical(family)
        start_prices = path.prices[path.lookback]
        book = PortfolioBook(initial_nav, initial_weights, start_prices, 0.0, 0.0)
        for day, date in enumerate(path.dates):
            book.accrue_tpp(float(path.tpp_annual_rates[day]))
            current_prices = path.prices[path.lookback + day + 1]
            nav = book.nav(current_prices)
            daily_rows.append(
                {
                    "family": family,
                    "date": date,
                    "day": day + 1,
                    "nav": nav,
                    "return": nav / initial_nav - 1.0,
                }
            )
        final_prices = path.prices[-1]
        final_nav = book.nav(final_prices)
        price_changes = final_prices / start_prices - 1.0
        for ticker, weight, start, end, change in zip(
            runtime.market.tickers, initial_weights[:-1], start_prices, final_prices, price_changes
        ):
            asset_rows.append(
                {
                    "family": family,
                    "asset": ticker,
                    "initial_weight": weight,
                    "start_price": start,
                    "end_price": end,
                    "price_change": change,
                    "contribution_to_fund_return": weight * change,
                }
            )
        summary_rows.append(
            {
                "family": family,
                "days": path.horizon,
                "initial_nav": initial_nav,
                "final_nav": final_nav,
                "fund_return": final_nav / initial_nav - 1.0,
                "fund_pnl_try": final_nav - initial_nav,
                "fund_loss_try": max(0.0, initial_nav - final_nav),
                "worst_asset": runtime.market.tickers[int(np.argmin(price_changes))],
                "worst_asset_return": float(price_changes.min()),
            }
        )
    pd.DataFrame(summary_rows).to_csv(output_dir / "summary.csv", index=False)
    pd.DataFrame(asset_rows).to_csv(output_dir / "assets.csv", index=False)
    pd.DataFrame(daily_rows).to_csv(output_dir / "daily.csv", index=False)
    print(f"STATIC_STRESS_COMPLETE {output_dir}", flush=True)
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    args = parser.parse_args()
    build_static_outputs(build_runtime(args.config))


if __name__ == "__main__":
    main()
