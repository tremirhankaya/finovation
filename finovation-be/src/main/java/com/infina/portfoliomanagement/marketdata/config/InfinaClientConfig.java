package com.infina.portfoliomanagement.marketdata.config;

import com.infina.portfoliomanagement.marketdata.client.InfinaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class InfinaClientConfig {

    @Bean
    public RestClient infinaHttpClient(RestClient.Builder builder, InfinaProperties properties) {
        return builder
                .baseUrl(properties.baseUrl())
                .defaultHeader("Accept", "application/json")
                .defaultHeader("x-api-key", properties.apiKey())
                .build();
    }
}