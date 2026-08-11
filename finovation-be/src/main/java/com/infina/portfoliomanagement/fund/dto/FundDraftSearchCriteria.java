package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.enums.FundDraftSortField;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundDesignMode;
import com.infina.portfoliomanagement.fund.enums.ManagementApproach;
import org.springframework.data.domain.Sort;

public record FundDraftSearchCriteria(
        int page,
        int size,
        String query,
        FundDraftStatus status,
        ManagementApproach managementApproach,
        FundDesignMode designMode,
        FundDraftSortField sortBy,
        Sort.Direction direction
) {
    public FundDraftSearchCriteria {
        query = query == null ? "" : query.trim();
        if (sortBy == null) sortBy = FundDraftSortField.CREATED_AT;
        if (direction == null) direction = Sort.Direction.DESC;
    }

    public boolean hasQuery() {
        return !query.isBlank();
    }

    public Sort toSort() {
        return Sort.by(direction, sortBy.getProperty())
                .and(Sort.by(Sort.Direction.DESC, "id"));
    }
}
