package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestAssetPathResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestPathPointResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestPortfolioPathPointResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestPortfolioPathResponse;
import com.infina.portfoliomanagement.stresstest.entity.StressScenarioAssetPath;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.entity.StressTestPositionSnapshot;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioAssetPathRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestPositionSnapshotRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StressTestPathService {

    private final UserRepository userRepository;
    private final StressTestRepository stressTestRepository;
    private final StressTestPositionSnapshotRepository snapshotRepository;
    private final StressScenarioAssetPathRepository stressScenarioAssetPathRepository;

    @Transactional(readOnly = true)
    public StressTestAssetPathResponse getAssetPath(
            String actorUsername,
            UUID testId,
            String assetCode
    ) {
        StressTest stressTest = findOwnedStressTest(
                actorUsername,
                testId
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
    public StressTestPortfolioPathResponse getPortfolioPath(
            String actorUsername,
            UUID testId
    ) {
        StressTest stressTest = findOwnedStressTest(
                actorUsername,
                testId
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

        boolean incompletePath =
                pathsByDay.isEmpty()
                        || pathsByDay.values()
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
                            .reduce(
                                    BigDecimal.ZERO,
                                    BigDecimal::add
                            );

                    return new StressTestPortfolioPathPointResponse(
                            dayPaths.getFirst().getPathDate(),
                            dayIndex,
                            portfolioImpact
                    );
                })
                .toList();

        return new StressTestPortfolioPathResponse(points);
    }

    private StressTest findOwnedStressTest(
            String actorUsername,
            UUID testId
    ) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() ->
                        new BaseException(ErrorCode.USER_NOT_FOUND)
                );

        return stressTestRepository
                .findByPublicIdAndUserIdAndDeletedFalse(
                        testId,
                        actor.getId()
                )
                .orElseThrow(() ->
                        new BaseException(ErrorCode.STRESS_TEST_NOT_FOUND)
                );
    }
}