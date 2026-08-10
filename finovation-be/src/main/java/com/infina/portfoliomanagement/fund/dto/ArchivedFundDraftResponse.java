package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.repository.projection.ArchivedFundDraftProjection;

import java.time.LocalDateTime;
import java.util.UUID;

public record ArchivedFundDraftResponse(
        UUID draftId,
        String name,
        FundDraftStatus status,
        LocalDateTime archivedAt
) {
    public static ArchivedFundDraftResponse from(ArchivedFundDraftProjection projection) {
        return new ArchivedFundDraftResponse(
                UUID.fromString(projection.getPublicId()),
                projection.getName(),
                FundDraftStatus.valueOf(projection.getStatus()),
                projection.getArchivedAt()
        );
    }
}
