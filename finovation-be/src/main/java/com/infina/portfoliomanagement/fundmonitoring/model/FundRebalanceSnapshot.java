package com.infina.portfoliomanagement.fundmonitoring.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record FundRebalanceSnapshot(
        Long id,
        LocalDateTime effectiveAt,
        List<Position> positions
) {
    public record Position(
            Long assetId,
            BigDecimal targetWeight,
            BigDecimal quantity
    ) {
    }
}
