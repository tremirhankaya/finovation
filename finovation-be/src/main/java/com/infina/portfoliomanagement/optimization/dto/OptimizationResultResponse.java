package com.infina.portfoliomanagement.optimization.dto;

import java.time.LocalDateTime;
import java.util.List;

public record OptimizationResultResponse(
        LocalDateTime generatedAt,
        List<OptimizationResultAssetResponse> assets,
        List<OptimizationResultMetricResponse> metrics
) {
}
