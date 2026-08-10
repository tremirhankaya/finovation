package com.infina.portfoliomanagement.common.time;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.LocalDate;
import java.time.ZoneId;

@ConfigurationProperties(prefix = "financial-time")
public record FinancialTimeProperties(
        boolean simulationEnabled,
        LocalDate systemAnchorDate,
        LocalDate financialAnchorDate,
        ZoneId zone
) {
}
