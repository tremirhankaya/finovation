from __future__ import annotations

from typing import Annotated, Literal

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


NonNegativeInt = Annotated[int, Field(ge=0, le=30)]


class OptimizeRequest(StrictApiModel):
    request_id: RequestId | None = Field(
        default=None,
        description="Java tarafından üretilen benzersiz iş isteği kimliği / client request identifier.",
    )
    horizon: Horizon = Field(description="Tahmin vadesi / forecast horizon: 3M, 6M or 12M.")
    current_portfolio: dict[str, Weight] = Field(
        description="CASH_TPP dahil, toplamı 1.0 olan mevcut portföy / current portfolio."
    )
    locked_assets: dict[str, Weight] = Field(
        description="Tam ağırlığı korunacak varlıklar / exact-weight locked assets."
    )
    mandatory_assets: list[str] = Field(
        default_factory=list,
        description=(
            "Son portföyde bulunması zorunlu hisseler; mevcutsa ağırlığı değişebilir, "
            "yeni ise max_additions limitini tüketir / required final holdings."
        ),
    )
    excluded_assets: list[str] = Field(
        default_factory=list,
        description=(
            "Son portföyde bulunması yasak hisseler; mevcutsa çıkarılması max_removals "
            "limitini tüketir ve per-asset delta limitinden muaftır / forbidden final holdings."
        ),
    )
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
    max_weight_change_per_asset: Weight = Field(
        gt=0.0,
        description=(
            "Final portföyde kalan mevcut varlıklar ve CASH_TPP için en yüksek mutlak "
            "değişim; additions/removals muaftır / retained-asset delta limit."
        ),
    )
    max_additions: NonNegativeInt = Field(
        description="Eklenebilecek en fazla yeni hisse / maximum additions."
    )
    max_removals: NonNegativeInt = Field(
        description="Çıkarılabilecek en fazla mevcut hisse / maximum removals."
    )
    max_universe58_beta: PositiveFloat | None = Field(
        default=None,
        description="Opsiyonel Universe58 portföy beta hard cap / optional beta cap.",
    )

    @model_validator(mode="after")
    def validate_cross_fields(self) -> "OptimizeRequest":
        if self.min_stock_count > self.max_stock_count:
            raise ValueError("min_stock_count cannot exceed max_stock_count")
        if self.tpp_min_weight > self.tpp_max_weight:
            raise ValueError("tpp_min_weight cannot exceed tpp_max_weight")
        if "CASH_TPP" not in self.current_portfolio:
            raise ValueError("current_portfolio must contain CASH_TPP")
        total = sum(self.current_portfolio.values())
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"current_portfolio must sum to 1.0; received {total}")
        for asset, weight in self.locked_assets.items():
            if asset not in self.current_portfolio:
                raise ValueError(f"locked asset is not in current_portfolio: {asset}")
            if abs(weight - self.current_portfolio[asset]) > 1e-9:
                raise ValueError(f"locked weight does not match current portfolio: {asset}")
        mandatory = set(self.mandatory_assets)
        excluded = set(self.excluded_assets)
        if mandatory & excluded:
            raise ValueError("mandatory and excluded assets overlap")
        locked_excluded = set(self.locked_assets) & excluded
        if locked_excluded:
            raise ValueError(
                f"locked and excluded assets overlap: {sorted(locked_excluded)}"
            )
        return self

    def engine_payload(self) -> dict:
        return self.model_dump(mode="python", exclude_none=True)

    model_config = {
        **StrictApiModel.model_config,
        "json_schema_extra": {
            "examples": [bundled_example("optimize_request.json")]
        },
    }


class OptimizeAlternative(AlternativeBase):
    deltas: dict[str, float]
    added_assets: list[str]
    removed_assets: list[str]
    locked_assets: dict[str, float]
    realized_turnover_diagnostic: float


class OptimizeResponse(VersionedResponse):
    mode: Literal["OPTIMIZE"] = "OPTIMIZE"
    alternatives: list[OptimizeAlternative] = Field(min_length=3, max_length=3)
