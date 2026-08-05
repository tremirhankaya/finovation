package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.enums.ManagementApproach;

import java.math.BigDecimal;
import java.util.UUID;

public record FundDraftResponse(
        UUID draftId,
        Integer draftVersion,
        String name,
        FundType fundType,
        String currency,
        BigDecimal initialPortfolioSize,
        ManagementApproach managementApproach,
        Short liquidityTargetPct,
        FundDraftStatus status
) {
}
