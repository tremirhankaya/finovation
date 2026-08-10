package com.infina.portfoliomanagement.fundmonitoring.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;

@ConfigurationProperties(prefix = "fund.monitoring")
public record FundMonitoringProperties(
        BigDecimal policyRatePercent
) {

    public FundMonitoringProperties {
        if (policyRatePercent == null || policyRatePercent.signum() < 0) {
            throw new IllegalArgumentException("Policy rate percent must not be negative.");
        }
    }
}
