package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.repository.projection.ArchivedFundDraftProjection;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record ArchivedFundDraftResponse(
        UUID draftId,
        String name,
        FundDraftStatus status,
        LocalDateTime archivedAt,
        BigDecimal initialPortfolioSize,
        BigDecimal unitPrice,
        String deletedBy
) {
    public static ArchivedFundDraftResponse from(ArchivedFundDraftProjection projection) {
        return new ArchivedFundDraftResponse(
                UUID.fromString(projection.getPublicId()),
                projection.getName(),
                FundDraftStatus.valueOf(projection.getStatus()),
                projection.getArchivedAt(),
                projection.getInitialPortfolioSize(),
                projection.getUnitPrice(),
                projection.getDeletedBy()
        );
    }
}
