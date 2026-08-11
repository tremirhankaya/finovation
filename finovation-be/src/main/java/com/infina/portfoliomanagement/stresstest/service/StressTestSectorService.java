package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestSectorImpactResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestSectorPathPointResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestSectorPathResponse;
import com.infina.portfoliomanagement.stresstest.entity.StressScenarioAssetPath;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;
import com.infina.portfoliomanagement.stresstest.entity.StressTestPositionSnapshot;
import com.infina.portfoliomanagement.stresstest.repository.StressTestPositionSnapshotRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.infina.portfoliomanagement.stresstest.repository.StressScenarioAssetPathRepository;
import com.infina.portfoliomanagement.marketdata.entity.Sector;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StressTestSectorService {

    private final UserRepository userRepository;
    private final StressTestRepository stressTestRepository;
    private final StressTestPositionSnapshotRepository snapshotRepository;
    private final EquityDetailRepository equityDetailRepository;
    private final StressScenarioAssetPathRepository stressScenarioAssetPathRepository;

    @Transactional(readOnly = true)
    public List<StressTestSectorImpactResponse> getSectorImpacts(
            String actorUsername,
            UUID testId
    ) {
        StressTest stressTest = findOwnedStressTest(
                actorUsername,
                testId
        );

        var snapshots = getEquitySnapshots(stressTest.getId());

        if (snapshots.isEmpty()) {
            return List.of();
        }

        Map<Long, EquityDetail> equityDetailsByAssetId =
                getEquityDetailsByAssetId(snapshots);

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
    public List<StressTestSectorPathResponse> getSectorPaths(
            String actorUsername,
            UUID testId
    ) {
        StressTest stressTest = findOwnedStressTest(
                actorUsername,
                testId
        );

        var snapshots = getEquitySnapshots(stressTest.getId());

        if (snapshots.isEmpty()) {
            return List.of();
        }

        List<Long> assetIds = snapshots.stream()
                .map(StressTestPositionSnapshot::getAssetId)
                .toList();

        Map<Long, EquityDetail> detailsByAssetId =
                getEquityDetailsByAssetId(snapshots);

        Map<Long, BigDecimal> weightsByAssetId =
                buildWeightsByAssetId(snapshots);
        List<StressScenarioAssetPath> paths =
                getScenarioPaths(stressTest, assetIds);
        Map<Short, List<StressScenarioAssetPath>> pathsByDay =
                paths.stream()
                        .collect(Collectors.groupingBy(
                                StressScenarioAssetPath::getDayIndex
                        ));

        boolean incompleteCoverage =
                pathsByDay.isEmpty()
                        || pathsByDay.values()
                        .stream()
                        .anyMatch(dayPaths ->
                                dayPaths.size() != assetIds.size()
                        );

        if (incompleteCoverage) {
            throw new BaseException(
                    ErrorCode.STRESS_SCENARIO_COVERAGE_INCOMPLETE
            );
        }

        var snapshotsBySector =
                groupSnapshotsBySector(snapshots, detailsByAssetId);

        return snapshotsBySector.entrySet()
                .stream()
                .map(entry -> buildSectorPathResponse(
                        entry,
                        weightsByAssetId,
                        paths
                ))
                .sorted(Comparator.comparing(
                        StressTestSectorPathResponse::sectorName
                ))
                .toList();
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

    private List<StressTestPositionSnapshot> getEquitySnapshots(Long stressTestId) {
        return snapshotRepository
                .findAllByStressTestIdOrderByWeightDesc(stressTestId)
                .stream()
                .filter(snapshot ->
                        snapshot.getAssetType() == AssetType.EQUITY
                )
                .toList();
    }
    private Map<Long, EquityDetail> getEquityDetailsByAssetId(
            List<StressTestPositionSnapshot> snapshots
    ) {
        List<Long> assetIds = snapshots.stream()
                .map(StressTestPositionSnapshot::getAssetId)
                .toList();

        return equityDetailRepository
                .findAllByAssetIdIn(assetIds)
                .stream()
                .filter(detail -> detail.getSector() != null)
                .collect(Collectors.toMap(
                        EquityDetail::getAssetId,
                        Function.identity()
                ));
    }
    private Map<Long, BigDecimal> buildWeightsByAssetId(
            List<StressTestPositionSnapshot> snapshots
    ) {
        return snapshots.stream()
                .collect(Collectors.toMap(
                        StressTestPositionSnapshot::getAssetId,
                        snapshot -> snapshot.getWeight()
                                .divide(
                                        BigDecimal.valueOf(100),
                                        8,
                                        RoundingMode.HALF_UP
                                )
                ));
    }
    private List<StressScenarioAssetPath> getScenarioPaths(
            StressTest stressTest,
            List<Long> assetIds
    ) {
        return stressScenarioAssetPathRepository
                .findAllByScenarioIdAndAssetIdInOrderByDayIndexAsc(
                        stressTest.getScenario().getId(),
                        assetIds
                );
    }
    private Map<Sector, List<StressTestPositionSnapshot>> groupSnapshotsBySector(
            List<StressTestPositionSnapshot> snapshots,
            Map<Long, EquityDetail> detailsByAssetId
    ) {
        return snapshots.stream()
                .filter(snapshot ->
                        detailsByAssetId.containsKey(snapshot.getAssetId())
                )
                .collect(Collectors.groupingBy(
                        snapshot ->
                                detailsByAssetId
                                        .get(snapshot.getAssetId())
                                        .getSector()
                ));
    }
    private StressTestSectorPathResponse buildSectorPathResponse(
            Map.Entry<Sector, List<StressTestPositionSnapshot>> entry,
            Map<Long, BigDecimal> weightsByAssetId,
            List<StressScenarioAssetPath> paths
    ) {
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
    }
}