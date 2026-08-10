package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.dto.StressTestComputationResult;
import com.infina.portfoliomanagement.stresstest.dto.request.RunStressTestRequest;
import com.infina.portfoliomanagement.stresstest.dto.response.*;
import com.infina.portfoliomanagement.stresstest.engine.StressTestEngine;
import com.infina.portfoliomanagement.stresstest.entity.StressScenario;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.entity.StressTestPositionSnapshot;
import com.infina.portfoliomanagement.stresstest.enums.StressTestStatus;
import com.infina.portfoliomanagement.stresstest.mapper.StressTestResponseMapper;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioAssetPathRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestPositionSnapshotRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestAssetPathResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestPathPointResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestSectorImpactResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestPortfolioPathPointResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestPortfolioPathResponse;
import com.infina.portfoliomanagement.stresstest.entity.StressScenarioAssetPath;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestRiskMetricsResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestSectorPathPointResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestSectorPathResponse;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.Map;
import java.util.stream.Collectors;


import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class StressTestService {

    private final UserRepository userRepository;
    private final StressScenarioRepository stressScenarioRepository;
    private final StressPortfolioReader stressPortfolioReader;
    private final StressTestEngine stressTestEngine;
    private final StressTestPersistenceService persistenceService;
    private final StressTestResponseMapper responseMapper;
    private final StressTestRepository stressTestRepository;
    private final StressTestPositionSnapshotRepository snapshotRepository;
    private final Clock clock;
    private final StressScenarioAssetPathRepository stressScenarioAssetPathRepository;
    private final EquityDetailRepository equityDetailRepository;

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

        LocalDate asOfDate = resolveAsOfDate(LocalDate.now(clock));
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
                        .findAllByStressTestIdOrderByWeightDesc(
                                stressTest.getId()
                        )
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
    }

    @Transactional(readOnly = true)
    public StressTestAssetPathResponse getAssetPath(
            String actorUsername,
            UUID testId,
            String assetCode
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

        var snapshot = snapshotRepository
                .findAllByStressTestIdOrderByWeightDesc(stressTest.getId())
                .stream()
                .filter(item -> item.getAssetCode().equals(assetCode))
                .findFirst()
                .orElseThrow(() ->
                        new BaseException(ErrorCode.STRESS_TEST_NOT_FOUND)
                );

        var points = stressScenarioAssetPathRepository
                .findAllByScenarioIdAndAssetIdOrderByDayIndexAsc(
                        stressTest.getScenario().getId(),
                        snapshot.getAssetId()
                )
                .stream()
                .map(path -> new StressTestPathPointResponse(
                        path.getPathDate(),
                        path.getDayIndex(),
                        path.getCloseValue(),
                        path.getImpact()
                ))
                .toList();

        return new StressTestAssetPathResponse(
                snapshot.getAssetCode(),
                snapshot.getAssetType().name(),
                points
        );
    }

    @Transactional(readOnly = true)
    public List<StressTestSectorImpactResponse> getSectorImpacts(
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

        var snapshots = snapshotRepository
                .findAllByStressTestIdOrderByWeightDesc(
                        stressTest.getId()
                )
                .stream()
                .filter(snapshot ->
                        snapshot.getAssetType() == AssetType.EQUITY
                )
                .toList();

        if (snapshots.isEmpty()) {
            return List.of();
        }

        List<Long> assetIds = snapshots.stream()
                .map(StressTestPositionSnapshot::getAssetId)
                .toList();

        Map<Long, EquityDetail> equityDetailsByAssetId =
                equityDetailRepository
                        .findAllByAssetIdIn(assetIds)
                        .stream()
                        .filter(detail -> detail.getSector() != null)
                        .collect(Collectors.toMap(
                                EquityDetail::getAssetId,
                                Function.identity()
                        ));

        return snapshots.stream()
                .filter(snapshot ->
                        equityDetailsByAssetId.containsKey(
                                snapshot.getAssetId()
                        )
                )
                .collect(Collectors.groupingBy(snapshot ->
                        equityDetailsByAssetId
                                .get(snapshot.getAssetId())
                                .getSector()
                ))
                .entrySet()
                .stream()
                .map(entry -> {
                    var sector = entry.getKey();
                    var sectorSnapshots = entry.getValue();

                    BigDecimal weight = sectorSnapshots.stream()
                            .map(StressTestPositionSnapshot::getWeight)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    BigDecimal contribution = sectorSnapshots.stream()
                            .map(StressTestPositionSnapshot::getPortfolioContribution)
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    BigDecimal impact = weight.signum() == 0
                            ? BigDecimal.ZERO
                            : contribution
                            .multiply(BigDecimal.valueOf(100))
                            .divide(
                                    weight,
                                    12,
                                    RoundingMode.HALF_UP
                            );

                    return new StressTestSectorImpactResponse(
                            sector.getSectorCode(),
                            sector.getName(),
                            weight,
                            impact,
                            contribution
                    );
                })
                .sorted((a, b) ->
                        b.portfolioContribution()
                                .abs()
                                .compareTo(
                                        a.portfolioContribution().abs()
                                )
                )
                .toList();
    }
    @Transactional(readOnly = true)
    public StressTestPortfolioPathResponse getPortfolioPath(
            String actorUsername,
            UUID testId
    ) {
        return buildPortfolioPath(actorUsername, testId);
    }
    private StressTestPortfolioPathResponse buildPortfolioPath(
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

        var snapshots = snapshotRepository
                .findAllByStressTestIdOrderByWeightDesc(
                        stressTest.getId()
                );

        List<Long> assetIds = snapshots.stream()
                .map(StressTestPositionSnapshot::getAssetId)
                .toList();

        Map<Long, BigDecimal> weightsByAssetId = snapshots.stream()
                .collect(Collectors.toMap(
                        StressTestPositionSnapshot::getAssetId,
                        snapshot -> snapshot.getWeight()
                                .divide(
                                        BigDecimal.valueOf(100),
                                        8,
                                        RoundingMode.HALF_UP
                                )
                ));

        List<StressScenarioAssetPath> paths =
                stressScenarioAssetPathRepository
                        .findAllByScenarioIdAndAssetIdInOrderByDayIndexAsc(
                                stressTest.getScenario().getId(),
                                assetIds
                        );

        Map<Short, List<StressScenarioAssetPath>> pathsByDay =
                paths.stream()
                        .collect(Collectors.groupingBy(
                                StressScenarioAssetPath::getDayIndex
                        ));

        int expectedAssetCount = assetIds.size();

        boolean incompletePath = pathsByDay.values()
                .stream()
                .anyMatch(dayPaths ->
                        dayPaths.size() != expectedAssetCount
                );

        if (incompletePath) {
            throw new BaseException(
                    ErrorCode.STRESS_SCENARIO_COVERAGE_INCOMPLETE
            );
        }

        var points = pathsByDay.entrySet()
                .stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> {
                    Short dayIndex = entry.getKey();
                    var dayPaths = entry.getValue();

                    BigDecimal portfolioImpact = dayPaths.stream()
                            .map(path ->
                                    path.getImpact().multiply(
                                            weightsByAssetId.get(
                                                    path.getAsset().getId()
                                            )
                                    )
                            )
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    return new StressTestPortfolioPathPointResponse(
                            dayPaths.getFirst().getPathDate(),
                            dayIndex,
                            portfolioImpact
                    );
                })
                .toList();

        return new StressTestPortfolioPathResponse(points);
    }

    @Transactional(readOnly = true)
    public StressTestRiskMetricsResponse getRiskMetrics(
            String actorUsername,
            UUID testId
    ) {
        var points = buildPortfolioPath(actorUsername, testId).points();
        if (points.isEmpty()) {
            throw new BaseException(
                    ErrorCode.STRESS_SCENARIO_COVERAGE_INCOMPLETE
            );
        }

        var worstPoint = points.stream()
                .min(Comparator.comparing(
                        StressTestPortfolioPathPointResponse::portfolioImpact
                ))
                .orElseThrow();

        BigDecimal peakValue = BigDecimal.ONE;
        BigDecimal maxDrawdown = BigDecimal.ZERO;
        LocalDate maxDrawdownDate = points.getFirst().date();

        for (var point : points) {
            BigDecimal currentValue =
                    BigDecimal.ONE.add(point.portfolioImpact());

            if (currentValue.compareTo(peakValue) > 0) {
                peakValue = currentValue;
            }

            BigDecimal drawdown = currentValue
                    .divide(
                            peakValue,
                            12,
                            RoundingMode.HALF_UP
                    )
                    .subtract(BigDecimal.ONE);

            if (drawdown.compareTo(maxDrawdown) < 0) {
                maxDrawdown = drawdown;
                maxDrawdownDate = point.date();
            }
        }

        var finalPoint = points.getLast();

        BigDecimal troughValue =
                BigDecimal.ONE.add(worstPoint.portfolioImpact());

        BigDecimal finalValue =
                BigDecimal.ONE.add(finalPoint.portfolioImpact());

        BigDecimal recoveryFromTrough = finalValue
                .divide(
                        troughValue,
                        12,
                        RoundingMode.HALF_UP
                )
                .subtract(BigDecimal.ONE);

        return new StressTestRiskMetricsResponse(
                finalPoint.portfolioImpact(),
                maxDrawdown,
                maxDrawdownDate,
                worstPoint.portfolioImpact(),
                worstPoint.date(),
                recoveryFromTrough
        );
    }
    @Transactional(readOnly = true)
    public List<StressTestSectorPathResponse> getSectorPaths(
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

        var snapshots = snapshotRepository
                .findAllByStressTestIdOrderByWeightDesc(stressTest.getId())
                .stream()
                .filter(snapshot ->
                        snapshot.getAssetType() == AssetType.EQUITY
                )
                .toList();

        if (snapshots.isEmpty()) {
            return List.of();
        }

        List<Long> assetIds = snapshots.stream()
                .map(StressTestPositionSnapshot::getAssetId)
                .toList();

        Map<Long, EquityDetail> detailsByAssetId =
                equityDetailRepository
                        .findAllByAssetIdIn(assetIds)
                        .stream()
                        .filter(detail -> detail.getSector() != null)
                        .collect(Collectors.toMap(
                                EquityDetail::getAssetId,
                                Function.identity()
                        ));

        Map<Long, BigDecimal> weightsByAssetId = snapshots.stream()
                .collect(Collectors.toMap(
                        StressTestPositionSnapshot::getAssetId,
                        snapshot -> snapshot.getWeight()
                                .divide(
                                        BigDecimal.valueOf(100),
                                        8,
                                        RoundingMode.HALF_UP
                                )
                ));

        List<StressScenarioAssetPath> paths =
                stressScenarioAssetPathRepository
                        .findAllByScenarioIdAndAssetIdInOrderByDayIndexAsc(
                                stressTest.getScenario().getId(),
                                assetIds
                        );

        var snapshotsBySector = snapshots.stream()
                .filter(snapshot ->
                        detailsByAssetId.containsKey(snapshot.getAssetId())
                )
                .collect(Collectors.groupingBy(
                        snapshot ->
                                detailsByAssetId
                                        .get(snapshot.getAssetId())
                                        .getSector()
                ));

        return snapshotsBySector.entrySet()
                .stream()
                .map(entry -> {
                    var sector = entry.getKey();
                    var sectorSnapshots = entry.getValue();

                    var sectorAssetIds = sectorSnapshots.stream()
                            .map(StressTestPositionSnapshot::getAssetId)
                            .collect(Collectors.toSet());

                    BigDecimal sectorWeight = sectorSnapshots.stream()
                            .map(snapshot ->
                                    weightsByAssetId.get(snapshot.getAssetId())
                            )
                            .reduce(BigDecimal.ZERO, BigDecimal::add);

                    Map<Short, List<StressScenarioAssetPath>> pathsByDay =
                            paths.stream()
                                    .filter(path ->
                                            sectorAssetIds.contains(
                                                    path.getAsset().getId()
                                            )
                                    )
                                    .collect(Collectors.groupingBy(
                                            StressScenarioAssetPath::getDayIndex
                                    ));

                    var points = pathsByDay.entrySet()
                            .stream()
                            .sorted(Map.Entry.comparingByKey())
                            .map(dayEntry -> {
                                var dayPaths = dayEntry.getValue();

                                BigDecimal contribution = dayPaths.stream()
                                        .map(path ->
                                                path.getImpact().multiply(
                                                        weightsByAssetId.get(
                                                                path.getAsset().getId()
                                                        )
                                                )
                                        )
                                        .reduce(
                                                BigDecimal.ZERO,
                                                BigDecimal::add
                                        );

                                BigDecimal sectorImpact =
                                        sectorWeight.signum() == 0
                                                ? BigDecimal.ZERO
                                                : contribution.divide(
                                                sectorWeight,
                                                12,
                                                RoundingMode.HALF_UP
                                        );

                                return new StressTestSectorPathPointResponse(
                                        dayPaths.getFirst().getPathDate(),
                                        dayEntry.getKey(),
                                        sectorImpact
                                );
                            })
                            .toList();

                    return new StressTestSectorPathResponse(
                            sector.getSectorCode(),
                            sector.getName(),
                            points
                    );
                })
                .sorted(Comparator.comparing(
                        StressTestSectorPathResponse::sectorName
                ))
                .toList();
    }
}