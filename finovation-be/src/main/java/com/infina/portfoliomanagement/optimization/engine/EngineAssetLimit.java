package com.infina.portfoliomanagement.optimization.engine;

import java.math.BigDecimal;

public record EngineAssetLimit(
        String assetCode,
        BigDecimal minWeight,
        BigDecimal maxWeight
) {
}
