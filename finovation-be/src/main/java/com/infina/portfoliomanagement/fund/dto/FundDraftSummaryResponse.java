package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.enums.FundDesignMode;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.ManagementApproach;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record FundDraftSummaryResponse(
        UUID draftId,
        String name,
        ManagementApproach managementApproach,
        BigDecimal initialPortfolioSize,
        Integer currentStep,
        FundDraftStatus status,
        FundDesignMode designMode,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static FundDraftSummaryResponse from(FundDraft draft) {
        return new FundDraftSummaryResponse(
                draft.getPublicId(),
                draft.getName(),
                draft.getManagementApproach(),
                draft.getInitialPortfolioSize(),
                draft.getCurrentStep() == null ? null : draft.getCurrentStep().intValue(),
                draft.getStatus(),
                draft.getDesignMode(),
                draft.getCreatedAt(),
                draft.getUpdatedAt()
        );
    }
}
