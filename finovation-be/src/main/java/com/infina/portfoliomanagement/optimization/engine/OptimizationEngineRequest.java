package com.infina.portfoliomanagement.optimization.engine;

import java.util.List;
import java.util.UUID;

public record OptimizationEngineRequest(
        Long optimizationRequestId,
        UUID fundId,
        List<EngineConstraintTarget> constraintTargets,
        List<EngineAssetPreference> assetPreferences,
        List<EngineAssetLimit> assetLimits
) {
}
