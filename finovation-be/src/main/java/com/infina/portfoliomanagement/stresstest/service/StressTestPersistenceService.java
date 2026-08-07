package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioPosition;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressAssetResult;
import com.infina.portfoliomanagement.stresstest.dto.ai.AiStressTestResponse;
import com.infina.portfoliomanagement.stresstest.entity.StressScenario;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.entity.StressTestPositionSnapshot;
import com.infina.portfoliomanagement.stresstest.enums.StressTestStatus;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestPositionSnapshotRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StressTestPersistenceService {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final StressTestRepository stressTestRepository;
    private final StressTestPositionSnapshotRepository snapshotRepository;
    private final FundPortfolioRepository fundPortfolioRepository;
    private final StressScenarioRepository stressScenarioRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    @Transactional
    public StressTest createRunningTest(
            Long userId,
            Long scenarioId,
            Long portfolioId,
            String requestId,
            LocalDate asOfDate
    ) {
        User user = userRepository.getReferenceById(userId);
        StressScenario scenario = stressScenarioRepository.getReferenceById(scenarioId);
        FundPortfolio portfolio = fundPortfolioRepository.getReferenceById(portfolioId);

        StressTest stressTest = StressTest.builder()
                .publicId(UUID.randomUUID())
                .fundPortfolio(portfolio)
                .scenario(scenario)
                .user(user)
                .requestId(requestId)
                .asOfDate(asOfDate)
                .status(StressTestStatus.RUNNING)
                .deleted(false)
                .createdAt(LocalDateTime.now(clock))
                .build();

        return stressTestRepository.save(stressTest);
    }

    @Transactional
    public void completeTest(
            Long stressTestId,
            StressPortfolioSnapshot portfolio,
            AiStressTestResponse response
    ) {
        StressTest stressTest = stressTestRepository.getReferenceById(stressTestId);

        Map<String, AiStressAssetResult> resultsByAssetCode =
                response.assetResults()
                        .stream()
                        .collect(Collectors.toMap(
                                AiStressAssetResult::assetCode,
                                Function.identity()
                        ));

        List<StressTestPositionSnapshot> snapshots = portfolio.positions()
                .stream()
                .map(position -> createSnapshot(
                        stressTest,
                        position,
                        resultsByAssetCode
                ))
                .toList();

        snapshotRepository.saveAll(snapshots);

        stressTest.setPortfolioImpact(response.portfolioImpact());
        stressTest.setStatus(StressTestStatus.COMPLETED);
        stressTest.setCompletedAt(LocalDateTime.now(clock));
    }

    @Transactional
    public void markFailed(Long stressTestId) {
        StressTest stressTest = stressTestRepository.getReferenceById(stressTestId);

        stressTest.setStatus(StressTestStatus.FAILED);
        stressTest.setCompletedAt(LocalDateTime.now(clock));
    }

    private StressTestPositionSnapshot createSnapshot(
            StressTest stressTest,
            StressPortfolioPosition position,
            Map<String, AiStressAssetResult> resultsByAssetCode
    ) {
        AiStressAssetResult result =
                resultsByAssetCode.get(position.assetCode());

        BigDecimal normalizedWeight = position.weight()
                .divide(ONE_HUNDRED, 8, RoundingMode.HALF_UP);

        BigDecimal contribution =
                normalizedWeight.multiply(result.impact());

        return StressTestPositionSnapshot.builder()
                .stressTest(stressTest)
                .assetId(position.assetId())
                .assetCode(position.assetCode())
                .assetType(position.assetType())
                .weight(position.weight())
                .impact(result.impact())
                .portfolioContribution(contribution)
                .build();
    }
}