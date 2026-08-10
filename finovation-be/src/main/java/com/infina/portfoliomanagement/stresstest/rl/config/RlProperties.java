package com.infina.portfoliomanagement.stresstest.rl.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "rl")
public record RlProperties(
        String baseUrl,
        String inferencePath,
        String model,
        String apiKey
) {
}