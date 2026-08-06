package com.infina.portfoliomanagement.fundmonitoring.model;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FundValuationPoint(
        LocalDate date,
        BigDecimal nav,
        BigDecimal sharePrice
) {
}

