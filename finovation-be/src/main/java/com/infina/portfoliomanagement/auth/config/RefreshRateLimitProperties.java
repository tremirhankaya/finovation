package com.infina.portfoliomanagement.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "auth.refresh-rate-limit")
public record RefreshRateLimitProperties(
        Duration window,
        int maxAttempts
) {
    public RefreshRateLimitProperties {
        if (window == null || window.isNegative() || window.isZero()) {
            throw new IllegalArgumentException("Refresh rate limit window must be positive.");
        }
        if (maxAttempts < 1) {
            throw new IllegalArgumentException("Refresh rate limit max attempts must be positive.");
        }
    }
}