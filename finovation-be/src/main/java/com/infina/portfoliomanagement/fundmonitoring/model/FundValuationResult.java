package com.infina.portfoliomanagement.fundmonitoring.model;

import java.math.BigDecimal;
import java.util.List;

public record FundValuationResult(
        BigDecimal outstandingShares,
        List<FundValuationPoint> points,
        List<ValuedFundPosition> positions
) {
    public FundValuationPoint latestPoint() {
        return points.getLast();
    }
}
