package com.infina.portfoliomanagement.fund.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record CreateFundDraftRequest(
        @NotBlank
        String name,

        @NotNull
        @Positive
        BigDecimal initialPortfolioSize,

        @NotNull
        @Positive
        BigDecimal unitPrice
) {
}
