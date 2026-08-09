package com.infina.portfoliomanagement.fund.service.analysis;

import com.infina.portfoliomanagement.fund.dto.analysis.FundEngineCreateResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisRequest;

public interface FundModelClient {

    FundEngineCreateResponse analyze(FundModelAnalysisRequest request);
}
