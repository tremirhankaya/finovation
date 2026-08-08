package com.infina.portfoliomanagement.fund.client;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;


abstract class FundEngineHttpTemplate {

    private static final Logger log = LoggerFactory.getLogger(FundEngineHttpTemplate.class);

    private final RestClient restClient;

    protected FundEngineHttpTemplate(@Qualifier("fundEngineRestClient") RestClient restClient) {
        this.restClient = restClient;
    }


    protected <T> T post(String path, Object requestBody, Class<T> responseType) {
        log.info("[FundEngine] --> POST {}", path);
        try {
            T response = restClient
                    .post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                        log.error("[FundEngine] 4xx error: status={} path={}", res.getStatusCode(), path);
                        throw new BaseException(ErrorCode.FUND_ENGINE_INVALID_REQUEST);
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (req, res) -> {
                        log.error("[FundEngine] 5xx error: status={} path={}", res.getStatusCode(), path);
                        throw new BaseException(ErrorCode.FUND_ENGINE_ERROR);
                    })
                    .body(responseType);

            if (response == null) {
                log.error("[FundEngine] Empty response body from {}", path);
                throw new BaseException(ErrorCode.FUND_ENGINE_ERROR);
            }

            log.info("[FundEngine] <-- 200 OK {}", path);
            return response;

        } catch (BaseException e) {
            throw e;
        } catch (ResourceAccessException e) {
            log.error("[FundEngine] Network error {}: {}", path, e.getMessage());
            throw new BaseException(ErrorCode.FUND_ENGINE_UNAVAILABLE);
        } catch (RestClientResponseException e) {
            log.error("[FundEngine] Unexpected response: status={} body={}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new BaseException(ErrorCode.FUND_ENGINE_ERROR);
        } catch (Exception e) {
            log.error("[FundEngine] Unexpected error {}: {}", path, e.getMessage(), e);
            throw new BaseException(ErrorCode.FUND_ENGINE_ERROR);
        }
    }
}
