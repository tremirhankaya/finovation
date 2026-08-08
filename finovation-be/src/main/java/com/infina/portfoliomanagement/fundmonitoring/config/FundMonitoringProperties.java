package com.infina.portfoliomanagement.fundmonitoring.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;

@ConfigurationProperties(prefix = "fund.monitoring")
public record FundMonitoringProperties(
        BigDecimal fixedOutstandingShares,
        BigDecimal policyRatePercent
) {

    public FundMonitoringProperties {
        if (fixedOutstandingShares == null || fixedOutstandingShares.signum() <= 0) {
            throw new IllegalArgumentException("Fixed outstanding shares must be positive.");
        }
        if (policyRatePercent == null || policyRatePercent.signum() < 0) {
            throw new IllegalArgumentException("Policy rate percent must not be negative.");
        }
    }
}

