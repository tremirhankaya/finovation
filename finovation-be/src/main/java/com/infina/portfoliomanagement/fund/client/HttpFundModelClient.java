package com.infina.portfoliomanagement.fund.client;

import com.infina.portfoliomanagement.ai.client.AiHttpClient;
import com.infina.portfoliomanagement.fund.dto.analysis.FundEngineCreateResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisRequest;
import com.infina.portfoliomanagement.fund.service.analysis.FundModelClient;
import com.infina.portfoliomanagement.ai.enums.AiEndpoint;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Component
@Primary
public class HttpFundModelClient implements FundModelClient {

    private final AiHttpClient aiHttpClient;

    public HttpFundModelClient(AiHttpClient aiHttpClient) {
        this.aiHttpClient = aiHttpClient;
    }

    @Override
    public FundEngineCreateResponse analyze(FundModelAnalysisRequest request) {
        return aiHttpClient.post(AiEndpoint.CREATE_PORTFOLIO, request, FundEngineCreateResponse.class);
    }
}
