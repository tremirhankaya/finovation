package com.infina.portfoliomanagement.stresstest.rl.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

public record RlStressTestDayResponse(
        int dayNumber,
        LocalDate date,
        BigDecimal rlNav,
        BigDecimal passiveNav,
        Map<String, BigDecimal> weights
) {
}