package com.infina.portfoliomanagement.optimization.engine;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Component
public class HttpOptimizationEngineClient implements OptimizationEngineClient {

    private static final String RESILIENCE_INSTANCE = "fund-engine";
    private static final String OPTIMIZE_PATH = "/api/v1/portfolios/optimize";

    private final RestClient mlEngineHttpClient;
    private final ObjectMapper mlEngineObjectMapper;
    private final MlEngineProperties properties;

    public HttpOptimizationEngineClient(
            @Qualifier("mlEngineHttpClient") RestClient mlEngineHttpClient,
            @Qualifier("mlEngineObjectMapper") ObjectMapper mlEngineObjectMapper,
            MlEngineProperties properties
    ) {
        this.mlEngineHttpClient = mlEngineHttpClient;
        this.mlEngineObjectMapper = mlEngineObjectMapper;
        this.properties = properties;
    }

    @Override
    @Retry(name = RESILIENCE_INSTANCE, fallbackMethod = "handleEngineFailure")
    @CircuitBreaker(name = RESILIENCE_INSTANCE, fallbackMethod = "handleEngineFailure")
    public OptimizationEngineResult run(OptimizationEngineRequest request) {
        String requestId = request.requestId();
        String requestBody = mlEngineObjectMapper.writeValueAsString(request);

        JsonNode responseBody;
        try {
            responseBody = mlEngineHttpClient.post()
                    .uri(OPTIMIZE_PATH)
                    .header("X-Request-Id", requestId)
                    .header("X-Expected-Model-Snapshot", properties.expectedModelSnapshot())
                    .body(requestBody)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpServerErrorException.ServiceUnavailable | ResourceAccessException retryableFailure) {
            // 503 and network/timeout failures propagate raw so the resilience4j retry
            // decorator (which wraps this whole method call) can retry the entire request
            // with the same request_id/body, per the engine's documented retry policy.
            throw retryableFailure;
        } catch (RestClientResponseException nonRetryableFailure) {
            // 400/409/422/500 are never retried — translate immediately so the circuit
            // breaker's "ignore-exceptions: BaseException" treats these as business
            // outcomes, not service-health failures.
            throw translateHttpError(nonRetryableFailure, requestId);
        }

        if (responseBody == null) {
            log.error("Fund engine optimize: empty response body, requestId={}", requestId);
            throw new BaseException(
                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                    "The optimization engine returned an empty response."
            );
        }

        return mlEngineObjectMapper.convertValue(responseBody, OptimizationEngineResult.class);
    }

    @SuppressWarnings("unused")
    private OptimizationEngineResult handleEngineFailure(OptimizationEngineRequest request, Exception exception) {
        if (exception instanceof BaseException baseException) {
            throw baseException;
        }
        if (exception instanceof RestClientResponseException httpException) {
            throw translateHttpError(httpException, request.requestId());
        }

        log.error(
                "Fund engine optimize failed after retries: requestId={}",
                request.requestId(), exception
        );
        throw new BaseException(
                ErrorCode.EXTERNAL_SERVICE_ERROR,
                "The optimization engine is unavailable."
        );
    }

    private BaseException translateHttpError(RestClientResponseException e, String requestId) {
        String responseBodyText = e.getResponseBodyAsString();
        String engineErrorCode = null;
        String engineErrorMessage = e.getMessage();

        if (responseBodyText != null && !responseBodyText.isBlank()) {
            try {
                JsonNode errorBody = mlEngineObjectMapper.readTree(responseBodyText);
                JsonNode error = errorBody.path("error");
                if (!error.isMissingNode()) {
                    engineErrorCode = error.path("code").asString(null);
                    engineErrorMessage = error.path("message").asString(engineErrorMessage);
                }
            } catch (RuntimeException parseFailure) {
                log.warn("Fund engine optimize: failed to parse error body, requestId={}", requestId, parseFailure);
            }
        }

        log.error(
                "Fund engine optimize failed: status={}, code={}, message={}, requestId={}, body={}",
                e.getStatusCode(), engineErrorCode, engineErrorMessage, requestId, responseBodyText
        );

        if (engineErrorCode == null) {
            return new BaseException(ErrorCode.EXTERNAL_SERVICE_ERROR, "The optimization engine returned an error.");
        }

        return OptimizationEngineErrorTranslator.translate(engineErrorCode, engineErrorMessage);
    }
}
