package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.ManagementApproach;

public record FundDraftSearchCriteria(
        int page,
        int size,
        String query,
        FundDraftStatus status,
        ManagementApproach managementApproach
) {
    public FundDraftSearchCriteria {
        query = query == null ? "" : query.trim();
    }

    public boolean hasQuery() {
        return !query.isBlank();
    }
}
