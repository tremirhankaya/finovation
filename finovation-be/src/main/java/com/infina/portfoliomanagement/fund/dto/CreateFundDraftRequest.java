package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.validation.FundNameRules;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateFundDraftRequest(
        @NotBlank
        @Size(min = FundNameRules.MIN_LETTER_COUNT, max = FundNameRules.MAX_LENGTH)
        String name,

        @NotNull
        @Positive
        BigDecimal initialPortfolioSize,

        @NotNull
        @Positive
        BigDecimal unitPrice
) {
}
