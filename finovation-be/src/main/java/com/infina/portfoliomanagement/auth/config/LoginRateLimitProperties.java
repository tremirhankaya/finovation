package com.infina.portfoliomanagement.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "auth.login-rate-limit")
public record LoginRateLimitProperties(
        Duration window,
        int maxAttempts
) {
    public LoginRateLimitProperties {
        if (window == null || window.isNegative() || window.isZero()) {
            throw new IllegalArgumentException("Login rate limit window must be positive.");
        }
        if (maxAttempts < 1) {
            throw new IllegalArgumentException("Login rate limit max attempts must be positive.");
        }
    }
}