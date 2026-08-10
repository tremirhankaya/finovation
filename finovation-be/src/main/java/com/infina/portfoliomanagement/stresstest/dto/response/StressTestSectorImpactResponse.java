package com.infina.portfoliomanagement.stresstest.dto.response;

import java.math.BigDecimal;

public record StressTestSectorImpactResponse(
        String sectorCode,
        String sectorName,
        BigDecimal weight,
        BigDecimal impact,
        BigDecimal portfolioContribution
) {
}