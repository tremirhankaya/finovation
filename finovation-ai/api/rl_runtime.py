from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from api.settings import ServiceSettings
from bist_stress_service import RlInferenceEngine


@dataclass
class RlRuntimeState:
    settings: ServiceSettings
    engine: RlInferenceEngine | None = None
    ready: bool = False
    startup_error: str | None = None
    loaded_at_utc: str | None = None
    load_count: int = 0

    def initialize(self) -> None:
        if self.load_count > 0:
            return
        self.load_count += 1
        try:
            self.engine = RlInferenceEngine.load(self.settings.root)
            self.ready = True
            self.startup_error = None
            self.loaded_at_utc = datetime.now(timezone.utc).isoformat()
        except Exception as exc:
            self.engine = None
            self.ready = False
            self.startup_error = f"{type(exc).__name__}: {exc}"
