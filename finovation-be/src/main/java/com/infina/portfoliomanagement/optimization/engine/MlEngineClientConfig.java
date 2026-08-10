package com.infina.portfoliomanagement.optimization.engine;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.PropertyNamingStrategies;
import tools.jackson.databind.json.JsonMapper;

import java.net.http.HttpClient;

@Configuration
public class MlEngineClientConfig {

    @Bean
    public ObjectMapper mlEngineObjectMapper() {
        return JsonMapper.builder()
                .propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .build();
    }

    @Bean
    public RestClient mlEngineHttpClient(RestClient.Builder builder, MlEngineProperties properties) {
        return builder
                .baseUrl(properties.baseUrl())
                .defaultHeader("Content-Type", "application/json")
                .defaultHeader("Accept", "application/json")
                .requestFactory(mlEngineRequestFactory(properties))
                .requestInterceptor((request, body, execution) -> {
                    if (properties.apiKey() != null && !properties.apiKey().isBlank()) {
                        request.getHeaders().setBearerAuth(properties.apiKey());
                    }
                    return execution.execute(request, body);
                })
                .build();
    }

    private ClientHttpRequestFactory mlEngineRequestFactory(MlEngineProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .build();

        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        return requestFactory;
    }
}
