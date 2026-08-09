package com.infina.portfoliomanagement.fund.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;


@ConfigurationProperties(prefix = "fund-engine")
public record FundEngineProperties(


        String baseUrl,

        Duration connectTimeout,

        Duration readTimeout
) {
    public FundEngineProperties {
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "http://localhost:8000";
        if (connectTimeout == null) connectTimeout = Duration.ofSeconds(5);
        if (readTimeout == null)    readTimeout    = Duration.ofSeconds(120);
    }
}
