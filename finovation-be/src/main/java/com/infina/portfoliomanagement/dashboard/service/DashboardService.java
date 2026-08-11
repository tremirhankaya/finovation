package com.infina.portfoliomanagement.dashboard.service;

import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.dashboard.dto.DashboardSummaryResponse;
import com.infina.portfoliomanagement.dashboard.dto.DashboardSummaryResponse.UnavailableSection;
import com.infina.portfoliomanagement.fund.dto.FundDraftSummaryResponse;
import com.infina.portfoliomanagement.fund.service.FundDraftService;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundSummaryResponse;
import com.infina.portfoliomanagement.fundmonitoring.service.FundMonitoringService;
import com.infina.portfoliomanagement.optimization.dto.OptimizationLogEntryResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultResponse;
import com.infina.portfoliomanagement.optimization.service.OptimizationRequestService;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestHistoryResponse;
import com.infina.portfoliomanagement.stresstest.service.StressTestQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.List;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardService {

    private final FundMonitoringService fundMonitoringService;
    private final FundDraftService fundDraftService;
    private final OptimizationRequestService optimizationRequestService;
    private final StressTestQueryService stressTestQueryService;
    private final FinancialTimeProvider financialTime;

    public DashboardSummaryResponse getSummary(String actorUsername) {
        EnumSet<UnavailableSection> unavailableSections =
                EnumSet.noneOf(UnavailableSection.class);

        List<FundSummaryResponse> funds = loadSection(
                UnavailableSection.FUNDS,
                () -> fundMonitoringService.listFunds(actorUsername, null),
                List.of(),
                unavailableSections
        );
        List<FundDraftSummaryResponse> drafts = loadSection(
                UnavailableSection.DRAFTS,
                () -> fundDraftService.listInProgressDrafts(actorUsername),
                List.of(),
                unavailableSections
        );
        List<OptimizationLogEntryResponse> optimizationLogs = loadSection(
                UnavailableSection.OPTIMIZATION,
                () -> optimizationRequestService.listLogs(actorUsername),
                List.of(),
                unavailableSections
        );

        OptimizationResultResponse latestOptimizationResult = optimizationLogs.stream()
                .filter(OptimizationLogEntryResponse::resultAvailable)
                .findFirst()
                .map(log -> loadSection(
                        UnavailableSection.OPTIMIZATION,
                        () -> optimizationRequestService.getResult(
                                actorUsername,
                                log.requestId()
                        ),
                        null,
                        unavailableSections
                ))
                .orElse(null);
        List<StressTestHistoryResponse> stressTests = loadSection(
                UnavailableSection.STRESS_TESTS,
                () -> stressTestQueryService.getHistory(actorUsername),
                List.of(),
                unavailableSections
        );

        return new DashboardSummaryResponse(
                financialTime.currentDate(),
                funds,
                drafts,
                optimizationLogs,
                latestOptimizationResult,
                stressTests,
                List.copyOf(unavailableSections)
        );
    }

    private <T> T loadSection(
            UnavailableSection section,
            Supplier<T> loader,
            T fallback,
            EnumSet<UnavailableSection> unavailableSections
    ) {
        try {
            return loader.get();
        } catch (RuntimeException exception) {
            unavailableSections.add(section);
            log.warn(
                    "Dashboard section {} could not be loaded: {}",
                    section,
                    exception.getMessage()
            );
            log.debug("Dashboard section failure details for {}", section, exception);
            return fallback;
        }
    }
}
