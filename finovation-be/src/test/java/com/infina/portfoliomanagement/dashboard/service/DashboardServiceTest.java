package com.infina.portfoliomanagement.dashboard.service;

import com.infina.portfoliomanagement.fund.dto.FundDraftSummaryResponse;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.service.FundDraftService;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundSummaryResponse;
import com.infina.portfoliomanagement.fundmonitoring.service.FundMonitoringService;
import com.infina.portfoliomanagement.optimization.dto.OptimizationLogEntryResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultResponse;
import com.infina.portfoliomanagement.optimization.enums.RequestStatus;
import com.infina.portfoliomanagement.optimization.service.OptimizationRequestService;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestHistoryResponse;
import com.infina.portfoliomanagement.stresstest.service.StressTestService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    private static final String USERNAME = "dashboard-user";

    @Mock
    private FundMonitoringService fundMonitoringService;
    @Mock
    private FundDraftService fundDraftService;
    @Mock
    private OptimizationRequestService optimizationRequestService;
    @Mock
    private StressTestService stressTestService;

    private DashboardService service;

    @BeforeEach
    void setUp() {
        service = new DashboardService(
                fundMonitoringService,
                fundDraftService,
                optimizationRequestService,
                stressTestService
        );
    }

    @Test
    void getSummary_aggregatesModuleDataAndLoadsLatestAvailableOptimizationResult() {
        FundSummaryResponse fund = new FundSummaryResponse(
                UUID.randomUUID(),
                "Atlas Fonu",
                FundType.EQUITY_INTENSIVE,
                "TRY",
                LocalDate.of(2026, 8, 1)
        );
        FundDraftSummaryResponse draft = new FundDraftSummaryResponse(
                UUID.randomUUID(),
                "Yeni Taslak",
                3,
                FundDraftStatus.IN_PROGRESS,
                LocalDateTime.of(2026, 8, 9, 12, 0)
        );
        OptimizationLogEntryResponse runningLog = optimizationLog(12L, false);
        OptimizationLogEntryResponse completedLog = optimizationLog(11L, true);
        OptimizationResultResponse optimizationResult = mock(OptimizationResultResponse.class);
        StressTestHistoryResponse stressTest = new StressTestHistoryResponse(
                UUID.randomUUID(),
                "GLOBAL_CRISIS",
                "Küresel Kriz",
                LocalDate.of(2026, 8, 8),
                new BigDecimal("-0.08"),
                LocalDateTime.of(2026, 8, 8, 15, 0)
        );

        when(fundMonitoringService.listFunds(USERNAME, null)).thenReturn(List.of(fund));
        when(fundDraftService.listInProgressDrafts(USERNAME)).thenReturn(List.of(draft));
        when(optimizationRequestService.listLogs(USERNAME))
                .thenReturn(List.of(runningLog, completedLog));
        when(optimizationRequestService.getResult(USERNAME, 11L))
                .thenReturn(optimizationResult);
        when(stressTestService.getHistory(USERNAME)).thenReturn(List.of(stressTest));

        var response = service.getSummary(USERNAME);

        assertThat(response.funds()).containsExactly(fund);
        assertThat(response.drafts()).containsExactly(draft);
        assertThat(response.optimizationLogs()).containsExactly(runningLog, completedLog);
        assertThat(response.latestOptimizationResult()).isSameAs(optimizationResult);
        assertThat(response.stressTests()).containsExactly(stressTest);
        verify(optimizationRequestService).getResult(USERNAME, 11L);
    }

    @Test
    void getSummary_withoutAvailableOptimizationResult_returnsNullResult() {
        OptimizationLogEntryResponse runningLog = optimizationLog(12L, false);

        when(fundMonitoringService.listFunds(USERNAME, null)).thenReturn(List.of());
        when(fundDraftService.listInProgressDrafts(USERNAME)).thenReturn(List.of());
        when(optimizationRequestService.listLogs(USERNAME)).thenReturn(List.of(runningLog));
        when(stressTestService.getHistory(USERNAME)).thenReturn(List.of());

        var response = service.getSummary(USERNAME);

        assertThat(response.latestOptimizationResult()).isNull();
        verify(optimizationRequestService, never()).getResult(USERNAME, 12L);
    }

    private OptimizationLogEntryResponse optimizationLog(
            Long requestId,
            boolean resultAvailable
    ) {
        return new OptimizationLogEntryResponse(
                requestId,
                UUID.randomUUID(),
                "Atlas Fonu",
                USERNAME,
                resultAvailable ? RequestStatus.COMPLETED : RequestStatus.RUNNING,
                LocalDateTime.of(2026, 8, 10, 10, 0),
                resultAvailable ? LocalDateTime.of(2026, 8, 10, 10, 5) : null,
                LocalDateTime.of(2026, 8, 10, 10, 5),
                resultAvailable
        );
    }
}
