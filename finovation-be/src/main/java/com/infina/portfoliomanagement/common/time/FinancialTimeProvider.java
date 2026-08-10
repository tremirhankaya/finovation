package com.infina.portfoliomanagement.common.time;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

@Component
@Slf4j
public class FinancialTimeProvider {

    private final Clock systemClock;
    private final FinancialTimeProperties properties;

    public FinancialTimeProvider(
            Clock systemClock,
            FinancialTimeProperties properties
    ) {
        this.systemClock = systemClock;
        this.properties = properties;
        validateConfiguration(properties);
        if (properties.simulationEnabled()) {
            log.info(
                    "Financial time simulation enabled with system anchor {}, financial anchor {} and current financial date {}",
                    properties.systemAnchorDate(),
                    properties.financialAnchorDate(),
                    currentDate()
            );
        }
    }

    public LocalDate currentDate() {
        return now().toLocalDate();
    }

    public LocalDateTime now() {
        ZoneId zone = properties.zone();
        LocalDateTime systemNow = LocalDateTime.now(systemClock.withZone(zone));
        if (!properties.simulationEnabled()) {
            return systemNow;
        }

        long elapsedDays = ChronoUnit.DAYS.between(
                properties.systemAnchorDate(),
                systemNow.toLocalDate()
        );
        LocalDate financialDate = properties.financialAnchorDate().plusDays(elapsedDays);
        return LocalDateTime.of(financialDate, systemNow.toLocalTime());
    }

    private static void validateConfiguration(FinancialTimeProperties properties) {
        Objects.requireNonNull(properties.zone(), "financial-time.zone must be configured");
        if (!properties.simulationEnabled()) {
            return;
        }
        Objects.requireNonNull(
                properties.systemAnchorDate(),
                "financial-time.system-anchor-date must be configured when simulation is enabled"
        );
        Objects.requireNonNull(
                properties.financialAnchorDate(),
                "financial-time.financial-anchor-date must be configured when simulation is enabled"
        );
    }
}
