package com.infina.portfoliomanagement.ai.client;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.ai.enums.AiEndpoint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;

@Component
public class AiHttpClient {

    private static final Logger log = LoggerFactory.getLogger(AiHttpClient.class);
    private final RestClient restClient;

    public AiHttpClient(
            RestClient.Builder restClientBuilder,
            @Value("${ai.engine.base-url}") String baseUrl,
            @Value("${ai.engine.api-key:}") String apiKey
    ) {
        this.restClient = restClientBuilder
                .baseUrl(baseUrl)
                .requestInterceptor((request, body, execution) -> {
                    if (apiKey != null && !apiKey.isBlank()) {
                        request.getHeaders().setBearerAuth(apiKey);
                    }
                    return execution.execute(request, body);
                })
                .build();
    }

    public <T, R> R post(AiEndpoint endpoint, T requestBody, Class<R> responseType) {
        String path = endpoint.getPath();
        log.info("[AiEngine] --> POST {}", path);
        try {
            R response = restClient
                    .post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                        log.error("[AiEngine] 4xx error: status={} path={}", res.getStatusCode(), path);
                        throw new BaseException(ErrorCode.STRESS_TEST_NOT_FOUND);
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (req, res) -> {
                        log.error("[AiEngine] 5xx error: status={} path={}", res.getStatusCode(), path);
                        throw new BaseException(ErrorCode.STRESS_TEST_NOT_FOUND);
                    })
                    .body(responseType);

            if (response == null) {
                log.error("[AiEngine] Empty response body from {}", path);
                throw new BaseException(ErrorCode.STRESS_TEST_NOT_FOUND);
            }

            log.info("[AiEngine] <-- 200 OK {}", path);
            return response;

        } catch (BaseException e) {
            throw e;
        } catch (ResourceAccessException e) {
            log.error("[AiEngine] Network error {}: {}", path, e.getMessage());
            throw new BaseException(ErrorCode.STRESS_TEST_NOT_FOUND);
        } catch (RestClientResponseException e) {
            log.error("[AiEngine] Unexpected response: status={} body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new BaseException(ErrorCode.STRESS_TEST_NOT_FOUND);
        } catch (Exception e) {
            log.error("[AiEngine] Unexpected error: {}", e.getMessage());
            throw new BaseException(ErrorCode.STRESS_TEST_NOT_FOUND);
        }
    }
}
