package com.infina.portfoliomanagement.stresstest.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record StressTestPathPointResponse(
        LocalDate date,
        Short dayIndex,
        BigDecimal closeValue,
        BigDecimal impact
) {
}