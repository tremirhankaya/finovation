package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.stresstest.dto.StressAssetImpact;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioPosition;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.dto.StressTestComputationResult;
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
        StressScenario scenario =
                stressScenarioRepository.getReferenceById(scenarioId);
        FundPortfolio portfolio =
                fundPortfolioRepository.getReferenceById(portfolioId);

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
            StressTestComputationResult result
    ) {
        StressTest stressTest =
                stressTestRepository.getReferenceById(stressTestId);

        Map<Long, StressAssetImpact> impactsByAssetId =
                result.assetImpacts()
                        .stream()
                        .collect(Collectors.toMap(
                                StressAssetImpact::assetId,
                                Function.identity()
                        ));

        List<StressTestPositionSnapshot> snapshots =
                portfolio.positions()
                        .stream()
                        .map(position -> createSnapshot(
                                stressTest,
                                position,
                                impactsByAssetId.get(position.assetId())
                        ))
                        .toList();

        snapshotRepository.saveAll(snapshots);

        stressTest.setPortfolioImpact(result.portfolioImpact());
        stressTest.setStatus(StressTestStatus.COMPLETED);
        stressTest.setCompletedAt(LocalDateTime.now(clock));
    }

    @Transactional
    public void markFailed(Long stressTestId) {
        StressTest stressTest =
                stressTestRepository.getReferenceById(stressTestId);

        stressTest.setStatus(StressTestStatus.FAILED);
        stressTest.setCompletedAt(LocalDateTime.now(clock));
    }

    private StressTestPositionSnapshot createSnapshot(
            StressTest stressTest,
            StressPortfolioPosition position,
            StressAssetImpact impact
    ) {
        return StressTestPositionSnapshot.builder()
                .stressTest(stressTest)
                .assetId(position.assetId())
                .assetCode(position.assetCode())
                .assetType(position.assetType())
                .weight(position.weight())
                .impact(impact.impact())
                .portfolioContribution(
                        impact.portfolioContribution()
                )
                .build();
    }
}