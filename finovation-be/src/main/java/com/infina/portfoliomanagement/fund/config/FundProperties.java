package com.infina.portfoliomanagement.fund.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;

@ConfigurationProperties(prefix = "fund")
public record FundProperties(
        BigDecimal minInitialPortfolioSize,
        BigDecimal maxInitialPortfolioSize
) {
    public FundProperties {
        if (minInitialPortfolioSize == null || minInitialPortfolioSize.signum() <= 0) {
            throw new IllegalArgumentException("Minimum initial portfolio size must be positive.");
        }
        if (maxInitialPortfolioSize == null || maxInitialPortfolioSize.signum() <= 0) {
            throw new IllegalArgumentException("Maximum initial portfolio size must be positive.");
        }
        if (minInitialPortfolioSize.compareTo(maxInitialPortfolioSize) > 0) {
            throw new IllegalArgumentException(
                    "Minimum initial portfolio size must not exceed the maximum.");
        }
    }
}
