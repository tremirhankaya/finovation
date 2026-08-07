package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record FundDraftSummaryResponse(
        UUID draftId,
        String name,
        Integer currentStep,
        FundDraftStatus status,
        LocalDateTime updatedAt
) {
    public static FundDraftSummaryResponse from(FundDraft draft) {
        return new FundDraftSummaryResponse(
                draft.getPublicId(),
                draft.getName(),
                draft.getCurrentStep() == null ? null : draft.getCurrentStep().intValue(),
                draft.getStatus(),
                draft.getUpdatedAt()
        );
    }
}
