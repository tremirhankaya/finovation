package com.infina.portfoliomanagement.fundmonitoring.model;

import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.marketdata.entity.Asset;

import java.math.BigDecimal;

public record ValuedFundPosition(
        FundPosition position,
        Asset asset,
        BigDecimal quantity,
        BigDecimal currentValue,
        BigDecimal currentWeightPercentage
) {
}
