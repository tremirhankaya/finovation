package com.infina.portfoliomanagement.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "auth.password-reset.ip-rate-limit")
public record PasswordResetIpRateLimitProperties(
        Duration requestWindow,
        int requestMaxAttempts,
        Duration verifyWindow,
        int verifyMaxAttempts
) {
    public PasswordResetIpRateLimitProperties {
        if (requestWindow == null || requestWindow.isNegative() || requestWindow.isZero()) {
            throw new IllegalArgumentException("Password reset request IP rate limit window must be positive.");
        }
        if (requestMaxAttempts < 1) {
            throw new IllegalArgumentException("Password reset request IP max attempts must be positive.");
        }
        if (verifyWindow == null || verifyWindow.isNegative() || verifyWindow.isZero()) {
            throw new IllegalArgumentException("Password reset verify IP rate limit window must be positive.");
        }
        if (verifyMaxAttempts < 1) {
            throw new IllegalArgumentException("Password reset verify IP max attempts must be positive.");
        }
    }
}