package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.enums.FundDesignMode;
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
        BigDecimal unitPrice,

        FundDesignMode designMode
) {
    public CreateFundDraftRequest {
        if (designMode == null) designMode = FundDesignMode.AI_ASSISTED;
    }
}
