package com.infina.portfoliomanagement.optimization.engine;

import com.infina.portfoliomanagement.common.enums.AssetType;

import java.math.BigDecimal;

public record EngineProposedAsset(
        String assetCode,
        AssetType assetType,
        BigDecimal proposedWeight,
        String rationale
) {
}
