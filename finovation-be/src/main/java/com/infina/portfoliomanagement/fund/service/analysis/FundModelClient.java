package com.infina.portfoliomanagement.fund.service.analysis;

import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisResponse;

public interface FundModelClient {

    FundModelAnalysisResponse analyze(FundModelAnalysisRequest request);
}
