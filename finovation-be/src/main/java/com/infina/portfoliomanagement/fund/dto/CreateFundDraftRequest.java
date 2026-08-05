package com.infina.portfoliomanagement.fund.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record CreateFundDraftRequest(
        @NotNull
        @Positive
        BigDecimal initialPortfolioSize
) {
}
