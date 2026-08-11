package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.stresstest.engine.StressTestEngine;
import com.infina.portfoliomanagement.stresstest.mapper.StressTestResponseMapper;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.dto.request.RunStressTestRequest;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;
@ExtendWith(MockitoExtension.class)
class StressTestServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private StressScenarioRepository stressScenarioRepository;

    @Mock
    private StressPortfolioReader stressPortfolioReader;

    @Mock
    private StressTestEngine stressTestEngine;

    @Mock
    private StressTestPersistenceService persistenceService;

    @Mock
    private StressTestResponseMapper responseMapper;

    @Mock
    private FinancialTimeProvider financialTime;

    private StressTestService stressTestService;

    @BeforeEach
    void setUp() {
        stressTestService = new StressTestService(
                userRepository,
                stressScenarioRepository,
                stressPortfolioReader,
                stressTestEngine,
                persistenceService,
                responseMapper,
                financialTime
        );
    }
    @Test
    void shouldThrowUserNotFoundWhenActorDoesNotExist() {
        String username = "unknown-user";

        when(userRepository.findByUsername(username))
                .thenReturn(Optional.empty());

        BaseException exception = assertThrows(
                BaseException.class,
                () -> stressTestService.runStressTest(
                        username,
                        mock(RunStressTestRequest.class)
                )
        );

        assertEquals(
                ErrorCode.USER_NOT_FOUND,
                exception.getErrorCode()
        );

        verifyNoInteractions(
                stressScenarioRepository,
                stressPortfolioReader,
                stressTestEngine,
                persistenceService,
                responseMapper,
                financialTime
        );
    }
    @Test
    void shouldThrowScenarioNotFoundWhenScenarioDoesNotExist() {
        String username = "test-user";

        User user = mock(User.class);

        RunStressTestRequest request = mock(RunStressTestRequest.class);
        when(request.scenarioCode()).thenReturn("UNKNOWN_SCENARIO");

        when(userRepository.findByUsername(username))
                .thenReturn(Optional.of(user));

        when(stressScenarioRepository.findByCodeAndActiveTrue("UNKNOWN_SCENARIO"))
                .thenReturn(Optional.empty());

        BaseException exception = assertThrows(
                BaseException.class,
                () -> stressTestService.runStressTest(
                        username,
                        request
                )
        );

        assertEquals(
                ErrorCode.STRESS_SCENARIO_NOT_FOUND,
                exception.getErrorCode()
        );

        verifyNoInteractions(
                stressPortfolioReader,
                stressTestEngine,
                persistenceService,
                responseMapper,
                financialTime
        );
    }

}