package com.infina.portfoliomanagement.fundmonitoring.model;

import java.util.List;

public record FundValuationResult(
        List<FundValuationPoint> points,
        List<ValuedFundPosition> positions
) {
    public FundValuationPoint latestPoint() {
        return points.getLast();
    }
}
