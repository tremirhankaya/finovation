package com.infina.portfoliomanagement.optimization.engine;

import java.util.List;

public record OptimizationEngineResult(
        String requestId,
        String snapshotId,
        String systemDate,
        String forecastOrigin,
        String modelBundleId,
        String policyConfigId,
        double processingTimeMs,
        List<EngineAlternative> alternatives
) {
}
