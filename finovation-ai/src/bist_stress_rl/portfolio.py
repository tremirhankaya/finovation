from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class RebalanceResult:
    nav_before: float
    nav_after: float
    commission: float
    turnover: float
    equity_trades: np.ndarray
    weights_before: np.ndarray
    weights_after: np.ndarray


class PortfolioBook:
    """Long-only equity positions plus a TPP cash-like balance."""

    def __init__(
        self,
        initial_nav: float,
        initial_weights: np.ndarray,
        initial_prices: np.ndarray,
        buy_commission: float,
        sell_commission: float,
    ) -> None:
        initial_weights = np.asarray(initial_weights, dtype=np.float64)
        initial_prices = np.asarray(initial_prices, dtype=np.float64)
        if initial_weights.shape != (len(initial_prices) + 1,):
            raise ValueError("Initial weights and price dimensions disagree")
        if initial_nav <= 0 or np.any(initial_prices <= 0):
            raise ValueError("Initial NAV and prices must be positive")
        self.initial_nav = float(initial_nav)
        self.buy_commission = float(buy_commission)
        self.sell_commission = float(sell_commission)
        self.units = initial_nav * initial_weights[:-1] / initial_prices
        self.tpp_balance = float(initial_nav * initial_weights[-1])

    def clone(self) -> "PortfolioBook":
        copied = object.__new__(PortfolioBook)
        copied.initial_nav = self.initial_nav
        copied.buy_commission = self.buy_commission
        copied.sell_commission = self.sell_commission
        copied.units = self.units.copy()
        copied.tpp_balance = self.tpp_balance
        return copied

    def accrue_tpp(self, annual_rate_percent: float, calendar_days: int = 1) -> None:
        if calendar_days < 1:
            raise ValueError("TPP calendar accrual days must be positive")
        simple_rate = float(annual_rate_percent) / 100.0 * int(calendar_days) / 365.0
        self.tpp_balance *= 1.0 + simple_rate

    def equity_values(self, prices: np.ndarray) -> np.ndarray:
        return self.units * np.asarray(prices, dtype=np.float64)

    def nav(self, prices: np.ndarray) -> float:
        return float(self.equity_values(prices).sum() + self.tpp_balance)

    def weights(self, prices: np.ndarray) -> np.ndarray:
        values = self.equity_values(prices)
        nav = float(values.sum() + self.tpp_balance)
        if nav <= 0:
            raise RuntimeError("Portfolio NAV is not positive")
        return np.append(values, self.tpp_balance) / nav

    def rebalance(self, target_weights: np.ndarray, prices: np.ndarray) -> RebalanceResult:
        target = np.asarray(target_weights, dtype=np.float64)
        prices = np.asarray(prices, dtype=np.float64)
        current_equities = self.equity_values(prices)
        nav_before = float(current_equities.sum() + self.tpp_balance)
        weights_before = np.append(current_equities, self.tpp_balance) / nav_before

        def commission_for(final_nav: float) -> float:
            trades = target[:-1] * final_nav - current_equities
            buys = np.maximum(trades, 0.0).sum()
            sells = np.maximum(-trades, 0.0).sum()
            return float(self.buy_commission * buys + self.sell_commission * sells)

        low, high = 0.0, nav_before
        for _ in range(80):
            middle = 0.5 * (low + high)
            residual = nav_before - commission_for(middle) - middle
            if residual > 0:
                low = middle
            else:
                high = middle
        nav_after = 0.5 * (low + high)
        desired_equities = target[:-1] * nav_after
        equity_trades = desired_equities - current_equities
        commission = commission_for(nav_after)
        self.units = desired_equities / prices
        self.tpp_balance = float(target[-1] * nav_after)
        weights_after = self.weights(prices)
        turnover = 0.5 * float(np.abs(weights_after - weights_before).sum())
        return RebalanceResult(
            nav_before=nav_before,
            nav_after=self.nav(prices),
            commission=commission,
            turnover=turnover,
            equity_trades=equity_trades,
            weights_before=weights_before,
            weights_after=weights_after,
        )
