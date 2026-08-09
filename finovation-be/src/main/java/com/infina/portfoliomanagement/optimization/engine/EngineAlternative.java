package com.infina.portfoliomanagement.optimization.engine;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record EngineAlternative(
        String objectiveId,
        String horizon,
        Map<String, BigDecimal> weights,
        int stockCount,
        BigDecimal equityWeight,
        BigDecimal tppWeight,
        BigDecimal expectedModelUtilityLog,
        BigDecimal horizonVolatility,
        BigDecimal universe58Beta,
        Map<String, BigDecimal> sectorExposures,
        BigDecimal largePositionThreshold,
        List<String> largePositionAssets,
        BigDecimal largePositionTotalWeight,
        BigDecimal objectiveValue,
        Map<String, List<String>> reasonCodes,
        Map<String, List<String>> reasonTexts,
        String solutionClass,
        Map<String, BigDecimal> deltas,
        List<String> addedAssets,
        List<String> removedAssets,
        Map<String, BigDecimal> lockedAssets,
        BigDecimal realizedTurnoverDiagnostic
) {
}
