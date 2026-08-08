package com.infina.portfoliomanagement.optimization.engine;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record OptimizationEngineRequest(
        String requestId,
        String horizon,
        Map<String, BigDecimal> currentPortfolio,
        Map<String, BigDecimal> lockedAssets,
        List<String> mandatoryAssets,
        List<String> excludedAssets,
        int minStockCount,
        int maxStockCount,
        BigDecimal tppMinWeight,
        BigDecimal tppMaxWeight,
        BigDecimal maxWeightChangePerAsset,
        int maxAdditions,
        int maxRemovals,
        BigDecimal maxUniverse58Beta
) {
}
