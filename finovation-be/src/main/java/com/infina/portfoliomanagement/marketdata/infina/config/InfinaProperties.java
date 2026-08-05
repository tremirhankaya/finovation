package com.infina.portfoliomanagement.marketdata.infina.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "infina")
public record InfinaProperties(
        String baseUrl,
        String apiKey,
        Duration connectTimeout,
        Duration readTimeout
) {
    public InfinaProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("Infina base URL must not be blank.");
        }
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("Infina API key must not be blank.");
        }
        if (connectTimeout == null || connectTimeout.isNegative() || connectTimeout.isZero()) {
            throw new IllegalArgumentException("Infina connect timeout must be positive.");
        }
        if (readTimeout == null || readTimeout.isNegative() || readTimeout.isZero()) {
            throw new IllegalArgumentException("Infina read timeout must be positive.");
        }
    }
}
