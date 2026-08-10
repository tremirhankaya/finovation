package com.infina.portfoliomanagement.common.time;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class FinancialTimeProviderTest {

    private static final ZoneId ISTANBUL = ZoneId.of("Europe/Istanbul");

    @Test
    void simulationAdvancesWithTheSystemCalendar() {
        FinancialTimeProperties properties = new FinancialTimeProperties(
                true,
                LocalDate.of(2026, 8, 10),
                LocalDate.of(2025, 5, 29),
                ISTANBUL
        );

        FinancialTimeProvider firstDay = providerAt("2026-08-10T09:15:00Z", properties);
        FinancialTimeProvider nextDay = providerAt("2026-08-11T09:15:00Z", properties);

        assertThat(firstDay.now()).isEqualTo(LocalDateTime.of(2025, 5, 29, 12, 15));
        assertThat(nextDay.now()).isEqualTo(LocalDateTime.of(2025, 5, 30, 12, 15));
    }

    @Test
    void disabledSimulationUsesTheRealSystemTime() {
        FinancialTimeProperties properties = new FinancialTimeProperties(
                false,
                null,
                null,
                ISTANBUL
        );

        assertThat(providerAt("2026-08-10T09:15:00Z", properties).now())
                .isEqualTo(LocalDateTime.of(2026, 8, 10, 12, 15));
    }

    private static FinancialTimeProvider providerAt(
            String instant,
            FinancialTimeProperties properties
    ) {
        return new FinancialTimeProvider(
                Clock.fixed(Instant.parse(instant), ISTANBUL),
                properties
        );
    }
}
