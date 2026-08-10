package com.infina.portfoliomanagement.dashboard.dto;

import com.infina.portfoliomanagement.fund.dto.FundDraftSummaryResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundSummaryResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationLogEntryResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestHistoryResponse;

import java.util.List;

public record DashboardSummaryResponse(
        List<FundSummaryResponse> funds,
        List<FundDraftSummaryResponse> drafts,
        List<OptimizationLogEntryResponse> optimizationLogs,
        OptimizationResultResponse latestOptimizationResult,
        List<StressTestHistoryResponse> stressTests,
        List<UnavailableSection> unavailableSections
) {
    public enum UnavailableSection {
        FUNDS,
        DRAFTS,
        OPTIMIZATION,
        STRESS_TESTS
    }
}
