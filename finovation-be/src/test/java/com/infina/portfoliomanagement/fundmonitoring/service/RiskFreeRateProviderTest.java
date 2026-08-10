package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.fundmonitoring.config.FundMonitoringProperties;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Month;

import static org.assertj.core.api.Assertions.assertThat;

class RiskFreeRateProviderTest {

    private static final LocalDate AS_OF_DATE = LocalDate.of(
            2026,
            Month.AUGUST,
            5
    );

    @Test
    void annualRate_returnsConfiguredTcmbPolicyRate() {
        RiskFreeRateProvider provider = new RiskFreeRateProvider(
                new FundMonitoringProperties(
                        new BigDecimal("37")
                )
        );

        assertThat(provider.annualRate(AS_OF_DATE))
                .isEqualByComparingTo("37");
    }
}
