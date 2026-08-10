package com.infina.portfoliomanagement.stresstest.dto.response;

import java.util.List;

public record StressTestPortfolioPathResponse(
        List<StressTestPortfolioPathPointResponse> points
) {

    public StressTestPortfolioPathResponse {
        points = List.copyOf(points);
    }
}