package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.stresstest.client.StressTestAiClient;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressAssetResult;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressTestRequest;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressTestResponse;
import com.infina.portfoliomanagement.stresstest.dto.request.RunStressTestRequest;
import com.infina.portfoliomanagement.stresstest.entity.StressScenario;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.mapper.StressTestAiRequestMapper;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestPositionSnapshotRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import com.infina.portfoliomanagement.stresstest.dto.response.RunStressTestResponse;
import com.infina.portfoliomanagement.stresstest.mapper.StressTestResponseMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestHistoryResponse;
import com.infina.portfoliomanagement.stresstest.enums.StressTestStatus;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestDetailResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestAssetResponse;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StressTestService {

    private final UserRepository userRepository;
    private final StressScenarioRepository stressScenarioRepository;
    private final StressPortfolioReader stressPortfolioReader;
    private final StressTestAiRequestMapper aiRequestMapper;
    private final StressTestAiClient stressTestAiClient;
    private final StressTestPersistenceService persistenceService;
    private final StressTestResponseMapper responseMapper;
    private final FinancialTimeProvider financialTime;
    private final StressTestRepository stressTestRepository;
    private final StressTestPositionSnapshotRepository snapshotRepository;

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

        String requestId = "stress-" + UUID.randomUUID();
        LocalDate asOfDate = resolveAsOfDate(financialTime.currentDate());
        StressTest stressTest = persistenceService.createRunningTest(
                actor.getId(),
                scenario.getId(),
                portfolio.portfolioId(),
                requestId,
                asOfDate
        );


        try {
            AiStressTestRequest aiRequest = aiRequestMapper.toRequest(
                    requestId,
                    asOfDate,
                    scenario.getCode(),
                    portfolio
            );

            AiStressTestResponse aiResponse =
                    stressTestAiClient.runStressTest(aiRequest);

            validateAiResponse(
                    requestId,
                    portfolio,
                    aiResponse
            );

            persistenceService.completeTest(
                    stressTest.getId(),
                    portfolio,
                    aiResponse
            );

            return responseMapper.toResponse(
                    stressTest,
                    scenario,
                    portfolio,
                    aiResponse
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

    private void validateAiResponse(
            String requestId,
            StressPortfolioSnapshot portfolio,
            AiStressTestResponse response
    ) {
        if (response == null
                || response.requestId() == null
                || !requestId.equals(response.requestId())
                || response.portfolioImpact() == null
                || response.assetResults() == null) {
            throw new BaseException(ErrorCode.EXTERNAL_SERVICE_ERROR);
        }

        List<AiStressAssetResult> assetResults = response.assetResults();

        if (assetResults.stream().anyMatch(result ->
                result == null
                        || result.assetCode() == null
                        || result.assetCode().isBlank()
                        || result.impact() == null
        )) {
            throw new BaseException(ErrorCode.EXTERNAL_SERVICE_ERROR);
        }

        Set<String> responseAssetCodes = assetResults.stream()
                .map(AiStressAssetResult::assetCode)
                .collect(Collectors.toSet());

        if (responseAssetCodes.size() != assetResults.size()) {
            throw new BaseException(ErrorCode.EXTERNAL_SERVICE_ERROR);
        }

        Set<String> portfolioAssetCodes = portfolio.positions()
                .stream()
                .map(position -> position.assetCode())
                .collect(Collectors.toCollection(HashSet::new));

        if (!responseAssetCodes.equals(portfolioAssetCodes)) {
            throw new BaseException(ErrorCode.EXTERNAL_SERVICE_ERROR);
        }
    }

    @Transactional(readOnly = true)
    public List<StressTestHistoryResponse> getHistory(String actorUsername) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() ->
                        new BaseException(ErrorCode.USER_NOT_FOUND)
                );

        return stressTestRepository
                .findAllByUserIdAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                        actor.getId(),
                        StressTestStatus.COMPLETED
                )
                .stream()
                .map(stressTest -> new StressTestHistoryResponse(
                        stressTest.getPublicId(),
                        stressTest.getScenario().getCode(),
                        stressTest.getScenario().getName(),
                        stressTest.getAsOfDate(),
                        stressTest.getPortfolioImpact(),
                        stressTest.getCreatedAt()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public StressTestDetailResponse getDetail(
            String actorUsername,
            UUID testId
    ) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() ->
                        new BaseException(ErrorCode.USER_NOT_FOUND)
                );

        StressTest stressTest = stressTestRepository
                .findByPublicIdAndUserIdAndDeletedFalse(
                        testId,
                        actor.getId()
                )
                .orElseThrow(() ->
                        new BaseException(ErrorCode.STRESS_TEST_NOT_FOUND)
                );

        List<StressTestAssetResponse> assets =
                snapshotRepository
                        .findAllByStressTestIdOrderByWeightDesc(stressTest.getId())
                        .stream()
                        .map(snapshot -> new StressTestAssetResponse(
                                snapshot.getAssetCode(),
                                snapshot.getAssetType(),
                                snapshot.getWeight(),
                                snapshot.getImpact(),
                                snapshot.getPortfolioContribution()
                        ))
                        .toList();

        return new StressTestDetailResponse(
                stressTest.getPublicId(),
                stressTest.getScenario().getCode(),
                stressTest.getScenario().getName(),
                stressTest.getAsOfDate(),
                stressTest.getPortfolioImpact(),
                stressTest.getCreatedAt(),
                assets
        );
    }

    @Transactional
    public void deleteStressTest(
            String actorUsername,
            UUID testId
    ) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() ->
                        new BaseException(ErrorCode.USER_NOT_FOUND)
                );

        StressTest stressTest = stressTestRepository
                .findByPublicIdAndUserIdAndDeletedFalse(
                        testId,
                        actor.getId()
                )
                .orElseThrow(() ->
                        new BaseException(ErrorCode.STRESS_TEST_NOT_FOUND)
                );

        stressTest.setDeleted(true);
        stressTestRepository.save(stressTest);
    }
}
