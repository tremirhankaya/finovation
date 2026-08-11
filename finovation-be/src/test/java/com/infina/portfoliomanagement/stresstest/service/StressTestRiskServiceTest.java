package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestPortfolioPathResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StressTestRiskServiceTest {

    @Mock
    private StressTestPathService pathService;

    @InjectMocks
    private StressTestRiskService riskService;

    @Test
    void shouldThrowCoverageIncompleteWhenPortfolioPathIsEmpty() {
        String username = "test-user";
        UUID testId = UUID.randomUUID();

        when(pathService.getPortfolioPath(username, testId))
                .thenReturn(new StressTestPortfolioPathResponse(List.of()));

        BaseException exception = assertThrows(
                BaseException.class,
                () -> riskService.getRiskMetrics(username, testId)
        );

        assertEquals(
                ErrorCode.STRESS_SCENARIO_COVERAGE_INCOMPLETE,
                exception.getErrorCode()
        );
    }
}