package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.dto.StressTestComputationResult;
import com.infina.portfoliomanagement.stresstest.dto.request.RunStressTestRequest;
import com.infina.portfoliomanagement.stresstest.dto.response.*;
import com.infina.portfoliomanagement.stresstest.engine.StressTestEngine;
import com.infina.portfoliomanagement.stresstest.entity.StressScenario;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.mapper.StressTestResponseMapper;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StressTestService {

    private final UserRepository userRepository;
    private final StressScenarioRepository stressScenarioRepository;
    private final StressPortfolioReader stressPortfolioReader;
    private final StressTestEngine stressTestEngine;
    private final StressTestPersistenceService persistenceService;
    private final StressTestResponseMapper responseMapper;
    private final FinancialTimeProvider financialTime;


    public RunStressTestResponse runStressTest(
            String actorUsername,
            RunStressTestRequest request
    ) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() ->
                        new BaseException(ErrorCode.USER_NOT_FOUND)
                );

        StressScenario scenario = stressScenarioRepository
                .findByCodeAndActiveTrue(request.scenarioCode())
                .orElseThrow(() ->
                        new BaseException(ErrorCode.STRESS_SCENARIO_NOT_FOUND)
                );

        StressPortfolioSnapshot portfolio =
                stressPortfolioReader.readSelectedPortfolio(
                        actor.getId(),
                        request.fundId()
                );

        LocalDate asOfDate = resolveAsOfDate(financialTime.currentDate());
        String requestId = "stress-" + UUID.randomUUID();

        StressTest stressTest = persistenceService.createRunningTest(
                actor.getId(),
                scenario.getId(),
                portfolio.portfolioId(),
                requestId,
                asOfDate
        );

        try {
            StressTestComputationResult result =
                    stressTestEngine.calculate(scenario, portfolio);

            persistenceService.completeTest(
                    stressTest.getId(),
                    portfolio,
                    result
            );

            return responseMapper.toResponse(
                    stressTest,
                    scenario,
                    portfolio,
                    result
            );
        } catch (RuntimeException exception) {
            persistenceService.markFailed(stressTest.getId());
            throw exception;
        }
    }


    private LocalDate resolveAsOfDate(LocalDate date) {
        return switch (date.getDayOfWeek()) {
            case SATURDAY -> date.minusDays(1);
            case SUNDAY -> date.minusDays(2);
            default -> date;
        };
    }
}
