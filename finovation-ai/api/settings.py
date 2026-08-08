from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


API_VERSION = "v1"
EXPECTED_FORECAST_SCHEMA = "EQUITY_FORECAST_BUNDLE_V3"
EXPECTED_POLICY_CONFIG = "PORTFOLIO_OBJECTIVES_V3_NEW_PROSPECTUS"


@dataclass(frozen=True)
class ServiceSettings:
    root: Path
    api_version: str = API_VERSION

    @classmethod
    def from_environment(cls) -> "ServiceSettings":
        default_root = Path(__file__).resolve().parents[1]
        configured = os.environ.get("FUND_ML_ROOT")
        root = Path(configured) if configured else default_root
        return cls(root=root.resolve())
