package com.infina.portfoliomanagement.dashboard.service;

import com.infina.portfoliomanagement.dashboard.dto.DashboardSummaryResponse;
import com.infina.portfoliomanagement.fund.service.FundDraftService;
import com.infina.portfoliomanagement.fundmonitoring.service.FundMonitoringService;
import com.infina.portfoliomanagement.optimization.dto.OptimizationLogEntryResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultResponse;
import com.infina.portfoliomanagement.optimization.service.OptimizationRequestService;
import com.infina.portfoliomanagement.stresstest.service.StressTestService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final FundMonitoringService fundMonitoringService;
    private final FundDraftService fundDraftService;
    private final OptimizationRequestService optimizationRequestService;
    private final StressTestService stressTestService;

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary(String actorUsername) {
        List<OptimizationLogEntryResponse> optimizationLogs =
                optimizationRequestService.listLogs(actorUsername);

        OptimizationResultResponse latestOptimizationResult = optimizationLogs.stream()
                .filter(OptimizationLogEntryResponse::resultAvailable)
                .findFirst()
                .map(log -> optimizationRequestService.getResult(
                        actorUsername,
                        log.requestId()
                ))
                .orElse(null);

        return new DashboardSummaryResponse(
                fundMonitoringService.listFunds(actorUsername, null),
                fundDraftService.listInProgressDrafts(actorUsername),
                optimizationLogs,
                latestOptimizationResult,
                stressTestService.getHistory(actorUsername)
        );
    }
}
