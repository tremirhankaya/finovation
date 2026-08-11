package com.infina.portfoliomanagement.stresstest.rl.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.stresstest.rl.dto.response.RlStressTestDayResponse;
import com.infina.portfoliomanagement.stresstest.rl.dto.response.RlStressTestDetailResponse;
import com.infina.portfoliomanagement.stresstest.rl.dto.response.RlStressTestHistoryResponse;
import com.infina.portfoliomanagement.stresstest.rl.entity.RlStressTest;
import com.infina.portfoliomanagement.stresstest.rl.entity.RlStressTestDay;
import com.infina.portfoliomanagement.stresstest.rl.entity.RlStressTestDayWeight;
import com.infina.portfoliomanagement.stresstest.rl.repository.RlStressTestDayRepository;
import com.infina.portfoliomanagement.stresstest.rl.repository.RlStressTestDayWeightRepository;
import com.infina.portfoliomanagement.stresstest.rl.repository.RlStressTestRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RlStressTestQueryService {

    private final RlStressTestRepository stressTestRepository;
    private final RlStressTestDayRepository dayRepository;
    private final RlStressTestDayWeightRepository weightRepository;
    private final UserRepository userRepository;

    public RlStressTestQueryService(
            RlStressTestRepository stressTestRepository,
            RlStressTestDayRepository dayRepository,
            RlStressTestDayWeightRepository weightRepository,
            UserRepository userRepository
    ) {
        this.stressTestRepository = stressTestRepository;
        this.dayRepository = dayRepository;
        this.weightRepository = weightRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<RlStressTestHistoryResponse> getHistory(
            String actorUsername
    ) {
        User actor = getUser(actorUsername);

        return stressTestRepository
                .findAllByUserIdOrderByCreatedAtDesc(actor.getId())
                .stream()
                .map(this::toHistoryResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public RlStressTestDetailResponse getDetail(
            String actorUsername,
            UUID testId
    ) {
        User actor = getUser(actorUsername);

        RlStressTest stressTest = stressTestRepository
                .findByPublicIdAndUserId(
                        testId,
                        actor.getId()
                )
                .orElseThrow(() ->
                        new BaseException(
                                ErrorCode.STRESS_TEST_NOT_FOUND
                        )
                );

        List<RlStressTestDayResponse> days =
                dayRepository
                        .findAllByStressTestIdOrderByDayNumberAsc(
                                stressTest.getId()
                        )
                        .stream()
                        .map(this::toDayResponse)
                        .toList();

        return new RlStressTestDetailResponse(
                stressTest.getPublicId(),
                stressTest.getModel(),
                stressTest.getScenarioCode(),
                stressTest.getScenarioStartDate(),
                stressTest.getScenarioEndDate(),
                stressTest.getTradingDayCount(),
                stressTest.getInitialNav(),
                stressTest.getFinalNav(),
                stressTest.getReturnPct(),
                stressTest.getPassiveFinalNav(),
                stressTest.getPassiveReturnPct(),
                stressTest.getOutperformanceAmount(),
                stressTest.getOutperformancePct(),
                stressTest.getTotalCommission(),
                stressTest.getCreatedAt(),
                days
        );
    }

    @Transactional
    public void delete(
            String actorUsername,
            UUID testId
    ) {
        User actor = getUser(actorUsername);

        RlStressTest stressTest = stressTestRepository
                .findByPublicIdAndUserId(
                        testId,
                        actor.getId()
                )
                .orElseThrow(() ->
                        new BaseException(
                                ErrorCode.STRESS_TEST_NOT_FOUND
                        )
                );

        List<RlStressTestDay> days =
                dayRepository.findAllByStressTestIdOrderByDayNumberAsc(
                        stressTest.getId()
                );

        for (RlStressTestDay day : days) {
            weightRepository.deleteAllByDayId(
                    day.getId()
            );
        }

        dayRepository.deleteAllByStressTestId(
                stressTest.getId()
        );

        stressTestRepository.delete(stressTest);
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() ->
                        new BaseException(
                                ErrorCode.USER_NOT_FOUND
                        )
                );
    }

    private RlStressTestHistoryResponse toHistoryResponse(
            RlStressTest stressTest
    ) {
        return new RlStressTestHistoryResponse(
                stressTest.getPublicId(),
                stressTest.getModel(),
                stressTest.getScenarioCode(),
                stressTest.getInitialNav(),
                stressTest.getFinalNav(),
                stressTest.getReturnPct(),
                stressTest.getPassiveReturnPct(),
                stressTest.getOutperformancePct(),
                stressTest.getCreatedAt()
        );
    }

    private RlStressTestDayResponse toDayResponse(
            RlStressTestDay day
    ) {
        Map<String, BigDecimal> weights = new LinkedHashMap<>();

        for (RlStressTestDayWeight weight :
                weightRepository.findAllByDayId(day.getId())) {

            weights.put(
                    weight.getAssetCode(),
                    weight.getWeight()
            );
        }

        return new RlStressTestDayResponse(
                day.getDayNumber(),
                day.getDate(),
                day.getTotalNewNav(),
                day.getPassiveNav(),
                weights
        );
    }
}