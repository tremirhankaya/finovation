package com.infina.portfoliomanagement.stresstest.dto.response;

import java.util.List;

public record StressTestSectorPathResponse(
        String sectorCode,
        String sectorName,
        List<StressTestSectorPathPointResponse> points
) {

    public StressTestSectorPathResponse {
        points = List.copyOf(points);
    }
}