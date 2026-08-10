package com.infina.portfoliomanagement.stresstest.dto.response;

import java.util.List;

public record StressTestAssetPathResponse(
        String assetCode,
        String assetType,
        List<StressTestPathPointResponse> points
) {
}