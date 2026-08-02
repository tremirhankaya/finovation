package com.infina.portfoliomanagement.marketdata.client;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "infina")
public record InfinaProperties(
        String baseUrl,

        String apiKey,

        Duration connectTimeout,

        Duration readTimeout) {
}