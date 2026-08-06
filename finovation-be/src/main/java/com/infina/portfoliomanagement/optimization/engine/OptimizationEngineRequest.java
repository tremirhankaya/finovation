package com.infina.portfoliomanagement.optimization.engine;

import java.util.List;

public record OptimizationEngineRequest(
        Long optimizationRequestId,
        Long fundId,
        List<EngineConstraintTarget> constraintTargets,
        List<EngineAssetPreference> assetPreferences,
        List<EngineAssetLimit> assetLimits
) {
}
