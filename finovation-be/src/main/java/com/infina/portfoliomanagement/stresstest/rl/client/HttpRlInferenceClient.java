package com.infina.portfoliomanagement.stresstest.rl.client;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.rl.config.RlProperties;
import com.infina.portfoliomanagement.stresstest.rl.dto.RlInferenceRequest;
import com.infina.portfoliomanagement.stresstest.rl.dto.RlInferenceResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Slf4j
@Component
public class HttpRlInferenceClient implements RlInferenceClient {

    private final RestClient restClient;
    private final RlProperties properties;

    public HttpRlInferenceClient(RlProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder()
                .baseUrl(properties.baseUrl())
                .build();
    }

    @Override
    public RlInferenceResponse run(RlInferenceRequest request) {
        try {
            return restClient.post()
                    .uri(properties.inferencePath())
                    .body(request)
                    .retrieve()
                    .body(RlInferenceResponse.class);

        } catch (RestClientResponseException exception) {
            throw mapResponseError(exception);

        } catch (ResourceAccessException exception) {
            log.error("RL inference service is unavailable.", exception);

            throw new BaseException(
                    ErrorCode.STRESS_RL_ENGINE_UNAVAILABLE
            );
        }
    }

    private BaseException mapResponseError(
            RestClientResponseException exception
    ) {
        HttpStatusCode status = exception.getStatusCode();

        log.error(
                "RL inference request failed. status={}, body={}",
                status,
                exception.getResponseBodyAsString()
        );

        if (status.value() == 422) {
            return new BaseException(
                    ErrorCode.STRESS_RL_PORTFOLIO_INVALID
            );
        }

        if (status.value() == 503) {
            return new BaseException(
                    ErrorCode.STRESS_RL_ENGINE_UNAVAILABLE
            );
        }

        return new BaseException(
                ErrorCode.STRESS_RL_ENGINE_ERROR
        );
    }
}