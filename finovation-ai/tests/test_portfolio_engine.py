from __future__ import annotations

import json
from pathlib import Path

import pytest

from fund_ml.portfolio import CASH, PortfolioEngine, PortfolioError


ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def engine() -> PortfolioEngine:
    return PortfolioEngine.load(ROOT)


def load_request(name: str) -> dict:
    return json.loads((ROOT / "examples" / name).read_text(encoding="utf-8"))


def assert_policy(result: dict, tpp_low: float, tpp_high: float) -> None:
    for alternative in result["alternatives"]:
        weights = alternative["weights"]
        assert abs(sum(weights.values()) - 1.0) < 2e-7
        assert tpp_low - 2e-7 <= weights[CASH] <= tpp_high + 2e-7
        assert 0.85 - 2e-7 <= alternative["equity_weight"] <= 0.95 + 2e-7
        assert 16 <= alternative["stock_count"] <= 30
        assert all(
            0.03 - 2e-7 <= weight <= 0.10 + 2e-7
            for asset, weight in weights.items()
            if asset != CASH
        )
        assert max(alternative["sector_exposures"].values()) <= 0.30 + 2e-7
        large_assets = [
            asset
            for asset, weight in weights.items()
            if asset != CASH and weight > 0.05 + 1e-10
        ]
        assert sum(weights[asset] for asset in large_assets) < 0.40
        assert alternative["large_position_assets"] == sorted(large_assets)
        assert abs(
            alternative["large_position_total_weight"]
            - sum(weights[asset] for asset in large_assets)
        ) < 1e-12
        assert alternative["weight_semantics"] == "CONTINUOUS_DECIMAL_NOT_INTEGER_PERCENT"


def test_create_is_valid_and_deterministic(engine: PortfolioEngine) -> None:
    request = load_request("create_request.json")
    first = engine.create(request)
    second = engine.create(request)
    assert first == second
    assert len(first["alternatives"]) == 2
    assert_policy(first, 0.07, 0.14)
    for alternative in first["alternatives"]:
        assert "ASELS.E" in alternative["weights"]
        assert "FENER.E" not in alternative["weights"]
        assert "GSRAY.E" not in alternative["weights"]
        assert alternative["universe58_beta"] <= 1.10 + 2e-7


def test_optimize_respects_lock_delta_and_membership_limits(engine: PortfolioEngine) -> None:
    request = load_request("optimize_request.json")
    result = engine.optimize(request)
    assert len(result["alternatives"]) == 3
    assert_policy(result, 0.07, 0.13)
    for alternative in result["alternatives"]:
        assert abs(alternative["weights"]["ASELS.E"] - 0.065) < 1e-9
        assert len(alternative["added_assets"]) <= request["max_additions"]
        assert len(alternative["removed_assets"]) <= request["max_removals"]
        retained = (
            set(request["current_portfolio"])
            - set(alternative["added_assets"])
            - set(alternative["removed_assets"])
        )
        assert max(abs(alternative["deltas"][asset]) for asset in retained) <= 0.0300002
        assert alternative["universe58_beta"] <= 1.10 + 2e-7
        assert "realized_turnover_diagnostic" in alternative


def test_optimize_honors_mandatory_and_excluded_assets(engine: PortfolioEngine) -> None:
    request = load_request("optimize_request.json")
    request.update(
        {
            "mandatory_assets": ["NETAS.E", "TCELL.E"],
            "excluded_assets": ["AEFES.E", "FENER.E"],
            "max_weight_change_per_asset": 0.065,
            "max_additions": 2,
            "max_removals": 2,
        }
    )
    first = engine.optimize(request)
    second = engine.optimize(request)
    assert first == second
    assert_policy(first, 0.07, 0.13)
    for alternative in first["alternatives"]:
        weights = alternative["weights"]
        assert {"NETAS.E", "TCELL.E"}.issubset(weights)
        assert {"AEFES.E", "FENER.E"}.isdisjoint(weights)
        assert "NETAS.E" in alternative["added_assets"]
        assert "AEFES.E" in alternative["removed_assets"]
        assert alternative["deltas"]["AEFES.E"] == pytest.approx(-0.065)
        assert "MANDATORY_ASSET" in alternative["reason_codes"]["NETAS.E"]
        assert "MANDATORY_ASSET" in alternative["reason_codes"]["TCELL.E"]
        assert len(alternative["added_assets"]) <= request["max_additions"]
        assert len(alternative["removed_assets"]) <= request["max_removals"]
        retained = (
            set(request["current_portfolio"])
            - set(alternative["added_assets"])
            - set(alternative["removed_assets"])
        )
        assert max(abs(alternative["deltas"][asset]) for asset in retained) <= 0.0650002
        assert alternative["weights"]["ASELS.E"] == pytest.approx(0.065)


def test_optimize_rejects_mandatory_excluded_overlap(engine: PortfolioEngine) -> None:
    request = load_request("optimize_request.json")
    request["mandatory_assets"] = ["TCELL.E"]
    request["excluded_assets"] = ["TCELL.E"]
    with pytest.raises(PortfolioError, match="mandatory and excluded"):
        engine.optimize(request)


def test_optimize_rejects_locked_excluded_overlap(engine: PortfolioEngine) -> None:
    request = load_request("optimize_request.json")
    request["excluded_assets"] = ["ASELS.E"]
    with pytest.raises(PortfolioError, match="locked and excluded"):
        engine.optimize(request)


def test_optimize_forced_membership_changes_consume_limits(engine: PortfolioEngine) -> None:
    mandatory = load_request("optimize_request.json")
    mandatory["mandatory_assets"] = ["NETAS.E"]
    mandatory["max_additions"] = 0
    with pytest.raises(PortfolioError, match="mandatory additions exceed"):
        engine.optimize(mandatory)

    excluded = load_request("optimize_request.json")
    excluded["excluded_assets"] = ["AEFES.E"]
    excluded["max_removals"] = 0
    with pytest.raises(PortfolioError, match="excluded removals exceed"):
        engine.optimize(excluded)


def test_optimize_forced_membership_exempt_from_delta_limit(engine: PortfolioEngine) -> None:
    excluded = load_request("optimize_request.json")
    excluded["excluded_assets"] = ["AEFES.E"]
    assert excluded["current_portfolio"]["AEFES.E"] > excluded["max_weight_change_per_asset"]
    excluded_result = engine.optimize(excluded)
    for alternative in excluded_result["alternatives"]:
        assert "AEFES.E" not in alternative["weights"]
        assert "AEFES.E" in alternative["removed_assets"]

    mandatory = load_request("optimize_request.json")
    mandatory["mandatory_assets"] = ["NETAS.E"]
    mandatory["max_weight_change_per_asset"] = 0.02
    mandatory_result = engine.optimize(mandatory)
    for alternative in mandatory_result["alternatives"]:
        assert 0.03 - 2e-7 <= alternative["weights"]["NETAS.E"] <= 0.10 + 2e-7
        assert "NETAS.E" in alternative["added_assets"]


def test_legacy_or_removed_fields_are_rejected(engine: PortfolioEngine) -> None:
    request = load_request("create_request.json")
    request["preferred_tpp_weight"] = 0.09
    with pytest.raises(PortfolioError, match="unknown request fields"):
        engine.create(request)
    optimize = load_request("optimize_request.json")
    optimize["max_turnover"] = 0.20
    with pytest.raises(PortfolioError, match="unknown request fields"):
        engine.optimize(optimize)


def test_invalid_current_portfolio_is_not_silently_normalized(engine: PortfolioEngine) -> None:
    request = load_request("optimize_request.json")
    request["current_portfolio"]["CASH_TPP"] = 0.11
    with pytest.raises(PortfolioError, match="sum to one"):
        engine.optimize(request)


def test_stock_count_below_new_floor_is_rejected(engine: PortfolioEngine) -> None:
    request = load_request("create_request.json")
    request["min_stock_count"] = 15
    with pytest.raises(PortfolioError, match="16..30"):
        engine.create(request)


def test_continuous_decimal_weights_are_supported(engine: PortfolioEngine) -> None:
    request = load_request("optimize_request.json")
    result = engine.optimize(request)
    assert any(
        abs(weight * 100 - round(weight * 100)) > 1e-6
        for alternative in result["alternatives"]
        for asset, weight in alternative["weights"].items()
        if asset != CASH
    )


def test_selected_stock_below_three_percent_is_rejected(engine: PortfolioEngine) -> None:
    request = load_request("optimize_request.json")
    previous = request["current_portfolio"]["MGROS.E"]
    request["current_portfolio"]["MGROS.E"] = 0.0278
    request["current_portfolio"][CASH] += previous - 0.0278
    with pytest.raises(PortfolioError, match="stock weight"):
        engine.optimize(request)


def test_exact_five_percent_is_not_a_large_position(engine: PortfolioEngine) -> None:
    request = load_request("optimize_request.json")
    current = request["current_portfolio"]
    first = "MGROS.E"
    second = "TCELL.E"
    transfer = 0.05 - current[first]
    current[first] = 0.05
    current[second] -= transfer
    stocks = [asset for asset in current if asset != CASH]
    large_assets, large_total = engine._large_position_metrics(current, stocks)
    assert first not in large_assets
    assert large_total == pytest.approx(0.39)
    engine._validate_current(current)


def test_forty_percent_large_position_total_is_rejected(engine: PortfolioEngine) -> None:
    request = load_request("optimize_request.json")
    request["current_portfolio"]["AEFES.E"] += 0.01
    request["current_portfolio"][CASH] -= 0.01
    with pytest.raises(PortfolioError, match="strictly below 40%"):
        engine.optimize(request)
