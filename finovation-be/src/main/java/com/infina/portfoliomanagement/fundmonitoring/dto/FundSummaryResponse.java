package com.infina.portfoliomanagement.fundmonitoring.dto;

import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.enums.FundType;

import java.time.LocalDate;
import java.util.UUID;

public record FundSummaryResponse(
        UUID id,
        String name,
        FundType type,
        String currency,
        LocalDate inceptionDate
) {
    public static FundSummaryResponse from(FundDraft fund) {
        return new FundSummaryResponse(
                fund.getPublicId(),
                fund.getName(),
                fund.getFundType(),
                fund.getCurrencyCode(),
                fund.getCreatedAt().toLocalDate()
        );
    }
}
