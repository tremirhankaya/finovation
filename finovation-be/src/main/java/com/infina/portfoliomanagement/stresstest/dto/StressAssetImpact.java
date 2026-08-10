package com.infina.portfoliomanagement.stresstest.dto;

import java.math.BigDecimal;

public record StressAssetImpact(
        Long assetId,
        String assetCode,
        BigDecimal impact,
        BigDecimal portfolioContribution
) {
}