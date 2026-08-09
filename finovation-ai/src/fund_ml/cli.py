from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from fund_ml.portfolio import PortfolioEngine, parse_horizon
from fund_ml.services import EngineBundles


def write_result(value: Any, output: Path | None) -> None:
    text = json.dumps(value, indent=2, ensure_ascii=False)
    if output is None:
        print(text)
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(text, encoding="utf-8")
    print(str(output.resolve()))


def main() -> None:
    parser = argparse.ArgumentParser(description="ML Fund Engine V2 command line")
    parser.add_argument("--root", type=Path, required=True)
    subparsers = parser.add_subparsers(dest="command", required=True)
    forecast = subparsers.add_parser("forecast")
    forecast.add_argument("--horizon", required=True)
    forecast.add_argument("--output", type=Path)
    create = subparsers.add_parser("create")
    create.add_argument("--request", type=Path, required=True)
    create.add_argument("--output", type=Path)
    optimize = subparsers.add_parser("optimize")
    optimize.add_argument("--request", type=Path, required=True)
    optimize.add_argument("--output", type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    if args.command == "forecast":
        bundles = EngineBundles.load(root)
        horizon = parse_horizon(args.horizon)
        frame = bundles.horizon_forecasts(horizon)
        columns = [
            "instrument_id",
            "horizon_months",
            "simple_q10",
            "simple_q50",
            "simple_q90",
            "rank_position",
            "rank_percentile",
            "model_artifact_id",
            "ranker_artifact_id",
        ]
        value = {
            "system_date": bundles.project["system_date"],
            "forecast_origin": bundles.project["forecast_origin"],
            "target_semantics": "SOURCE_PRICE_RETURN",
            "rows": frame[columns].to_dict(orient="records"),
        }
        write_result(value, args.output)
        return
    request = json.loads(args.request.read_text(encoding="utf-8"))
    engine = PortfolioEngine.load(root)
    if args.command == "create":
        value = engine.create(request)
    else:
        value = engine.optimize(request)
    write_result(value, args.output)


if __name__ == "__main__":
    main()
