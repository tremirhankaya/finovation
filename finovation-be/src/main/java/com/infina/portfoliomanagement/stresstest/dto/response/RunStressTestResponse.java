package com.infina.portfoliomanagement.stresstest.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record RunStressTestResponse(
        UUID testId,
        String scenarioCode,
        String scenarioName,
        LocalDate asOfDate,
        BigDecimal portfolioImpact,
        List<StressTestAssetResponse> assets
) {
}