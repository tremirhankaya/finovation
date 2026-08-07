package com.infina.portfoliomanagement.optimization.engine;

import java.util.List;

public record OptimizationEngineResult(
        List<EngineProposedAsset> proposedAssets,
        List<EngineConstraintEvaluation> constraintEvaluations,
        String modelVersion
) {
}
