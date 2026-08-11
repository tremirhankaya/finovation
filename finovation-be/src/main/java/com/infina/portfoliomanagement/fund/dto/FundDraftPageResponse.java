package com.infina.portfoliomanagement.fund.dto;

import java.util.List;

public record FundDraftPageResponse(
        List<FundDraftSummaryResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext,
        boolean hasPrevious
) {
}
