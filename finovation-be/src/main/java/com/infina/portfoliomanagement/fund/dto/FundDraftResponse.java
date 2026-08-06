package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.enums.ManagementApproach;
import lombok.Builder;

import java.math.BigDecimal;
import java.util.UUID;

@Builder
public record FundDraftResponse(
        UUID draftId,
        Integer draftVersion,
        String name,
        FundType fundType,
        String currency,
        BigDecimal initialPortfolioSize,
        BigDecimal unitPrice,
        ManagementApproach managementApproach,
        Short liquidityTargetPct,
        FundDraftStatus status
) {
    public static FundDraftResponse from(FundDraft draft) {
        return FundDraftResponse.builder()
                .draftId(draft.getPublicId())
                .draftVersion(draft.getVersion())
                .name(draft.getName())
                .fundType(draft.getFundType())
                .currency(draft.getCurrencyCode())
                .initialPortfolioSize(draft.getInitialPortfolioSize())
                .unitPrice(draft.getUnitPrice())
                .managementApproach(draft.getManagementApproach())
                .liquidityTargetPct(draft.getLiquidityTargetPct())
                .status(draft.getStatus())
                .build();
    }
}
