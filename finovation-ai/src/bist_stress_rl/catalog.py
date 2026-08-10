from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import numpy as np
import pandas as pd

from .config import load_config
from .constraints import ProspectusConstraints


def _sample_bounded_simplex(
    rng: np.random.Generator,
    count: int,
    total: float,
    lower: float,
    upper: float,
    attempts: int = 2_000,
) -> np.ndarray | None:
    if count == 0:
        return np.empty(0, dtype=np.float64) if abs(total) < 1e-12 else None
    minimum = count * lower
    maximum = count * upper
    if total < minimum - 1e-12 or total > maximum + 1e-12:
        return None
    remaining = total - minimum
    if remaining <= 1e-14:
        return np.full(count, lower, dtype=np.float64)
    for _ in range(attempts):
        fractions = rng.dirichlet(np.full(count, 3.0, dtype=np.float64))
        values = lower + remaining * fractions
        if np.all(values <= upper + 1e-12):
            return values
    return None


def _sample_legal_weights(
    rng: np.random.Generator,
    constraints: ProspectusConstraints,
    equity_count: int,
) -> np.ndarray | None:
    tpp = float(rng.uniform(constraints.tpp_min + 1e-5, constraints.tpp_max - 1e-5))
    equity_total = 1.0 - tpp
    heavy_count = int(rng.integers(2, 6))
    light_count = equity_count - heavy_count
    heavy_lower = constraints.heavy_threshold + 1e-6
    heavy_upper = constraints.stock_max
    light_lower = constraints.stock_min
    light_upper = min(0.05, constraints.stock_max)
    heavy_total_low = max(
        heavy_count * heavy_lower,
        equity_total - light_count * light_upper,
    )
    heavy_total_high = min(
        constraints.heavy_sum_max - 1e-5,
        heavy_count * heavy_upper,
        equity_total - light_count * light_lower,
    )
    if heavy_total_low >= heavy_total_high:
        return None
    heavy_total = float(rng.uniform(heavy_total_low, heavy_total_high))
    heavy_values = _sample_bounded_simplex(
        rng, heavy_count, heavy_total, heavy_lower, heavy_upper
    )
    light_values = _sample_bounded_simplex(
        rng, light_count, equity_total - heavy_total, light_lower, light_upper
    )
    if heavy_values is None or light_values is None:
        return None
    weights = np.empty(equity_count + 1, dtype=np.float64)
    heavy_indices = rng.choice(equity_count, size=heavy_count, replace=False)
    is_heavy = np.zeros(equity_count, dtype=bool)
    is_heavy[heavy_indices] = True
    weights[:-1][is_heavy] = rng.permutation(heavy_values)
    weights[:-1][~is_heavy] = rng.permutation(light_values)
    weights[-1] = tpp
    weights[-1] += 1.0 - float(weights.sum())
    return weights if constraints.validate(weights).ok else None


def generate_catalog(config: dict, force: bool = False) -> np.ndarray:
    tickers = config["universe"]["tickers"]
    symbols = tickers + [config["universe"]["tpp_symbol"]]
    constraints = ProspectusConstraints(config["constraints"], len(tickers))
    count = int(config["catalog"]["legal_portfolio_count"])
    output_npz = Path(config["catalog"]["save_npz"])
    output_csv = Path(config["catalog"]["save_csv"])
    output_hash = Path(config["catalog"]["save_hash"])
    if output_npz.exists() and not force:
        catalog = np.load(output_npz)["weights"].astype(np.float64)
        validate_catalog(catalog, constraints, count)
        return catalog

    rng = np.random.default_rng(int(config["catalog"]["generator_seed"]))
    initial_map = config["universe"]["initial_weights"]
    initial = np.asarray([initial_map[symbol] for symbol in symbols], dtype=np.float64)
    constraints.require(initial)
    rows: list[np.ndarray] = [initial]
    minimum_l1 = float(config["catalog"]["minimum_l1_distance"])
    attempts = 0
    while len(rows) < count and attempts < 1_000_000:
        attempts += 1
        candidate = _sample_legal_weights(rng, constraints, len(tickers))
        if candidate is None:
            continue
        if min(float(np.abs(candidate - row).sum()) for row in rows) < minimum_l1:
            continue
        rows.append(candidate)
    if len(rows) != count:
        raise RuntimeError(f"Generated {len(rows)} of {count} legal portfolios")
    catalog = np.vstack(rows)
    validate_catalog(catalog, constraints, count)
    output_npz.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(output_npz, weights=catalog, symbols=np.asarray(symbols))
    pd.DataFrame(catalog, columns=symbols).to_csv(output_csv, index_label="action_id")
    digest = hashlib.sha256(output_npz.read_bytes()).hexdigest()
    output_hash.write_text(digest + "\n", encoding="ascii")
    return catalog


def validate_catalog(
    catalog: np.ndarray,
    constraints: ProspectusConstraints,
    expected_count: int | None = None,
) -> None:
    if catalog.ndim != 2 or catalog.shape[1] != constraints.equity_count + 1:
        raise ValueError("Catalog shape is invalid")
    if expected_count is not None and catalog.shape[0] != expected_count:
        raise ValueError("Catalog row count is invalid")
    for index, row in enumerate(catalog):
        result = constraints.validate(row)
        if not result.ok:
            raise ValueError(f"Catalog row {index} is invalid: {result.violations}")


def nearest_catalog_index(catalog: np.ndarray, weights: np.ndarray) -> int:
    return int(np.argmin(np.abs(catalog - weights[None, :]).sum(axis=1)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    config = load_config(args.config)
    catalog = generate_catalog(config, force=args.force)
    print(f"Generated and validated {catalog.shape[0]} legal portfolios")


if __name__ == "__main__":
    main()

