package com.infina.portfoliomanagement.marketdata.infina.client;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
public class InfinaRestClient implements InfinaClient {

    private static final String RESILIENCE_INSTANCE = "infina";

    private final RestClient infinaHttpClient;
    private final ObjectMapper objectMapper;

    public InfinaRestClient(RestClient infinaHttpClient, ObjectMapper objectMapper) {
        this.infinaHttpClient = infinaHttpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    @RateLimiter(name = RESILIENCE_INSTANCE)
    @Retry(name = RESILIENCE_INSTANCE)
    @CircuitBreaker(name = RESILIENCE_INSTANCE)
    public <T> List<T> get(InfinaEndpoint endpoint, MultiValueMap<String, String> params, Class<T> itemType) {
        JsonNode data = fetchData(endpoint, params);
        JsonNode dataArray = data.path(endpoint.dataKey());
        if (!dataArray.isArray()) {
            return List.of();
        }

        List<T> items = new ArrayList<>();
        for (JsonNode item : dataArray) {
            items.add(objectMapper.convertValue(item, itemType));
        }
        return items;
    }

    @Override
    @RateLimiter(name = RESILIENCE_INSTANCE)
    @Retry(name = RESILIENCE_INSTANCE)
    @CircuitBreaker(name = RESILIENCE_INSTANCE)
    public <T> Optional<T> getObject(
            InfinaEndpoint endpoint,
            MultiValueMap<String, String> params,
            Class<T> responseType
    ) {
        JsonNode data = fetchData(endpoint, params);
        if (!data.isObject()) {
            return Optional.empty();
        }
        return Optional.of(objectMapper.convertValue(data, responseType));
    }

    private JsonNode fetchData(
            InfinaEndpoint endpoint,
            MultiValueMap<String, String> params
    ) {
        JsonNode root = infinaHttpClient.get()
                .uri(uriBuilder -> uriBuilder.path(endpoint.path()).queryParams(params).build())
                .retrieve()
                .body(JsonNode.class);

        if (root == null) {
            log.error("Infina/{}: empty response body", endpoint.dataKey());
            throw new BaseException(ErrorCode.EXTERNAL_SERVICE_ERROR);
        }

        JsonNode result = root.path("result");
        JsonNode summary = result.path("summary");
        int resultCode = summary.path("resultCode").asInt(-1);

        if (resultCode != 200) {
            log.error("Infina/{}: resultCode={}, message={}",
                    endpoint.dataKey(), resultCode, summary.path("resultMessage").asString("Unknown error"));
            throw new BaseException(ErrorCode.EXTERNAL_SERVICE_ERROR);
        }

        return result.path("data");
    }
}
