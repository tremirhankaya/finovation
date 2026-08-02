package com.infina.portfoliomanagement.marketdata.client;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.github.resilience4j.retry.annotation.Retry;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;

@Component
public class InfinaRestClient implements InfinaClient {

    private final RestClient infinaHttpClient;
    private final ObjectMapper objectMapper;

    public InfinaRestClient(RestClient infinaHttpClient, ObjectMapper objectMapper) {
        this.infinaHttpClient = infinaHttpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    @RateLimiter(name = "infina")
    @Retry(name = "infina")
    public <T> List<T> get(String endpoint, MultiValueMap<String, String> params, Class<T> itemType) {
        String path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
        String serviceName = path.substring(1);

        JsonNode root = infinaHttpClient.get()
                .uri(uriBuilder -> uriBuilder.path(path).queryParams(params).build())
                .retrieve()
                .body(JsonNode.class);

        JsonNode result = root.path("result");
        JsonNode summary = result.path("summary");
        int resultCode = summary.path("resultCode").asInt(-1);

        if (resultCode != 200) {
            throw new BaseException(ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "Infina/%s -> resultCode=%d, message=%s".formatted(
                            serviceName, resultCode, summary.path("resultMessage").asString("Unknown error")));
        }

        JsonNode dataArray = result.path("data").path(serviceName);
        List<T> items = new ArrayList<>();
        if (dataArray.isArray()) {
            for (JsonNode item : dataArray) {
                items.add(objectMapper.convertValue(item, itemType));
            }
        }
        return items;
    }
}