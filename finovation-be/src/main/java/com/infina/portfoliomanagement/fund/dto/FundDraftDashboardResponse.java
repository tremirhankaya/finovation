package com.infina.portfoliomanagement.fund.dto;

import java.util.List;

public record FundDraftDashboardResponse(
        long totalCount,
        List<FundDraftSummaryResponse> recentDrafts
) {
}
