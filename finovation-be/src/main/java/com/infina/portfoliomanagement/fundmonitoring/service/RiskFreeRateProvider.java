package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.fundmonitoring.config.FundMonitoringProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;

@Component
@RequiredArgsConstructor
public class RiskFreeRateProvider {

    private final FundMonitoringProperties properties;

    public BigDecimal annualRate(LocalDate asOfDate) {
        return properties.policyRatePercent();
    }
}
