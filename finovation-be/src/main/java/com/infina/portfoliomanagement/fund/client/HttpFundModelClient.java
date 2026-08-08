package com.infina.portfoliomanagement.fund.client;

import com.infina.portfoliomanagement.fund.dto.analysis.FundEngineCreateResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisRequest;
import com.infina.portfoliomanagement.fund.service.analysis.FundModelClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@Primary
public class HttpFundModelClient extends FundEngineHttpTemplate implements FundModelClient {

    private static final String CREATE_PATH   = "/api/v1/portfolios/create";

    public HttpFundModelClient(@Qualifier("fundEngineRestClient") RestClient restClient) {
        super(restClient);
    }


    @Override
    public FundEngineCreateResponse analyze(FundModelAnalysisRequest request) {
        return post(CREATE_PATH, request, FundEngineCreateResponse.class);
    }

}
