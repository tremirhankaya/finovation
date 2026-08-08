package com.infina.portfoliomanagement.optimization.engine;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "fund-engine")
public record MlEngineProperties(
        String baseUrl,
        String expectedModelSnapshot,
        Duration connectTimeout,
        Duration readTimeout
) {
    public MlEngineProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("Fund engine base URL must not be blank.");
        }
        if (expectedModelSnapshot == null || expectedModelSnapshot.isBlank()) {
            throw new IllegalArgumentException("Fund engine expected model snapshot must not be blank.");
        }
        if (connectTimeout == null || connectTimeout.isNegative() || connectTimeout.isZero()) {
            throw new IllegalArgumentException("Fund engine connect timeout must be positive.");
        }
        if (readTimeout == null || readTimeout.isNegative() || readTimeout.isZero()) {
            throw new IllegalArgumentException("Fund engine read timeout must be positive.");
        }
    }
}
