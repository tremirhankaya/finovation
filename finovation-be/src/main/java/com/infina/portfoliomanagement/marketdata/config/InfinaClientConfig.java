package com.infina.portfoliomanagement.marketdata.config;

import com.infina.portfoliomanagement.marketdata.client.InfinaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.support.HttpRequestWrapper;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Configuration
public class InfinaClientConfig {

    @Bean
    public RestClient infinaHttpClient(RestClient.Builder builder, InfinaProperties properties) {
        return builder
                .baseUrl(properties.baseUrl())
                .defaultHeader("Accept", "application/json")
                .requestInterceptor(apiKeyInterceptor(properties.apiKey()))
                .build();
    }

    private ClientHttpRequestInterceptor apiKeyInterceptor(String apiKey) {
        return (request, body, execution) -> {
            URI newUri = UriComponentsBuilder.fromUri(request.getURI())
                    .queryParam("api_key", apiKey)
                    .build(true)
                    .toUri();

            HttpRequest wrapped = new HttpRequestWrapper(request) {
                @Override
                public URI getURI() {
                    return newUri;
                }
            };
            return execution.execute(wrapped, body);
        };
    }
}