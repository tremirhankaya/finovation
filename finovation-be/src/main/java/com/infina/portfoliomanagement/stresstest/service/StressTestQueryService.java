package com.infina.portfoliomanagement.stresstest.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestHistoryResponse;
import com.infina.portfoliomanagement.stresstest.enums.StressTestStatus;
import com.infina.portfoliomanagement.stresstest.repository.StressTestPositionSnapshotRepository;
import com.infina.portfoliomanagement.stresstest.repository.StressTestRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestAssetResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestDetailResponse;
import com.infina.portfoliomanagement.stresstest.entity.StressTest;

import java.util.UUID;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class StressTestQueryService {

    private final UserRepository userRepository;
    private final StressTestRepository stressTestRepository;
    private final StressTestPositionSnapshotRepository snapshotRepository;

    @Transactional(readOnly = true)
    public List<StressTestHistoryResponse> getHistory(
            String actorUsername
    ) {
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
                .map(this::toHistoryResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<StressTestHistoryResponse> getLatestHistory(String actorUsername) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        return stressTestRepository
                .findFirstByUserIdAndStatusAndDeletedFalseOrderByCreatedAtDescIdDesc(
                        actor.getId(),
                        StressTestStatus.COMPLETED
                )
                .map(this::toHistoryResponse);
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

    private StressTestHistoryResponse toHistoryResponse(StressTest stressTest) {
        return new StressTestHistoryResponse(
                stressTest.getPublicId(),
                stressTest.getScenario().getCode(),
                stressTest.getScenario().getName(),
                stressTest.getAsOfDate(),
                stressTest.getPortfolioImpact(),
                stressTest.getCreatedAt()
        );
    }
}
