package com.infina.portfoliomanagement.optimization.engine;

import com.infina.portfoliomanagement.optimization.enums.AssetPreferenceType;

import java.math.BigDecimal;

public record EngineAssetPreference(
        String assetCode,
        AssetPreferenceType type,
        BigDecimal fixedWeight
) {
}
