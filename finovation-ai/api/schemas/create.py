from __future__ import annotations

from typing import Literal

from pydantic import Field, model_validator

from api.schemas.common import (
    AlternativeBase,
    Horizon,
    PositiveFloat,
    RequestId,
    StrictApiModel,
    VersionedResponse,
    Weight,
    bundled_example,
)


class CreateRequest(StrictApiModel):
    request_id: RequestId | None = Field(
        default=None,
        description="Java tarafından üretilen benzersiz iş isteği kimliği / client request identifier.",
    )
    horizon: Horizon = Field(description="Tahmin vadesi / forecast horizon: 3M, 6M or 12M.")
    min_stock_count: int = Field(
        ge=16, le=30, description="En düşük seçili hisse sayısı / minimum selected equities."
    )
    max_stock_count: int = Field(
        ge=16, le=30, description="En yüksek seçili hisse sayısı / maximum selected equities."
    )
    tpp_min_weight: Weight = Field(
        ge=0.05, le=0.15, description="CASH_TPP alt sınırı, 0–1 decimal / lower bound."
    )
    tpp_max_weight: Weight = Field(
        ge=0.05, le=0.15, description="CASH_TPP üst sınırı, 0–1 decimal / upper bound."
    )
    mandatory_assets: list[str] = Field(
        default_factory=list,
        description="Portföyde zorunlu hisseler / equities that must be selected.",
    )
    excluded_assets: list[str] = Field(
        default_factory=list,
        description="Aday havuzundan çıkarılan hisseler / excluded equities.",
    )
    max_universe58_beta: PositiveFloat | None = Field(
        default=None,
        description="Opsiyonel Universe58 portföy beta hard cap / optional beta cap.",
    )

    @model_validator(mode="after")
    def validate_cross_fields(self) -> "CreateRequest":
        if self.min_stock_count > self.max_stock_count:
            raise ValueError("min_stock_count cannot exceed max_stock_count")
        if self.tpp_min_weight > self.tpp_max_weight:
            raise ValueError("tpp_min_weight cannot exceed tpp_max_weight")
        if len(self.mandatory_assets) != len(set(self.mandatory_assets)):
            raise ValueError("mandatory_assets contains duplicates")
        if len(self.excluded_assets) != len(set(self.excluded_assets)):
            raise ValueError("excluded_assets contains duplicates")
        overlap = set(self.mandatory_assets) & set(self.excluded_assets)
        if overlap:
            raise ValueError(f"mandatory and excluded assets overlap: {sorted(overlap)}")
        if len(self.mandatory_assets) > self.max_stock_count:
            raise ValueError("mandatory asset count exceeds max_stock_count")
        return self

    def engine_payload(self) -> dict:
        return self.model_dump(mode="python", exclude_none=True)

    model_config = {
        **StrictApiModel.model_config,
        "json_schema_extra": {
            "examples": [bundled_example("create_request.json")]
        },
    }


class CreateResponse(VersionedResponse):
    mode: Literal["CREATE"] = "CREATE"
    alternatives: list[AlternativeBase] = Field(min_length=2, max_length=2)
