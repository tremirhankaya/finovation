package com.infina.portfoliomanagement.stresstest.dto;

import java.math.BigDecimal;
import java.util.List;

public record StressTestComputationResult(
        BigDecimal portfolioImpact,
        List<StressAssetImpact> assetImpacts
) {

    public StressTestComputationResult {
        assetImpacts = List.copyOf(assetImpacts);
    }
}