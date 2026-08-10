package com.infina.portfoliomanagement.stresstest.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record StressTestSectorPathPointResponse(
        LocalDate date,
        Short dayIndex,
        BigDecimal impact
) {
}