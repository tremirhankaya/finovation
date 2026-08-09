package com.infina.portfoliomanagement.optimization.dto;

import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundPositionResponse;

import java.util.List;

public record OptimizationFundPositionsResponse(
        String fundName,
        List<FundPositionResponse> positions
) {
}
