package com.infina.portfoliomanagement.stresstest.rl.service;

import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.stresstest.rl.dto.RlInferenceDay;
import com.infina.portfoliomanagement.stresstest.rl.dto.RlInferenceResponse;
import com.infina.portfoliomanagement.stresstest.rl.entity.RlStressTest;
import com.infina.portfoliomanagement.stresstest.rl.entity.RlStressTestDay;
import com.infina.portfoliomanagement.stresstest.rl.entity.RlStressTestDayWeight;
import com.infina.portfoliomanagement.stresstest.rl.repository.RlStressTestDayRepository;
import com.infina.portfoliomanagement.stresstest.rl.repository.RlStressTestDayWeightRepository;
import com.infina.portfoliomanagement.stresstest.rl.repository.RlStressTestRepository;
import com.infina.portfoliomanagement.user.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class RlStressTestPersistenceService {

    private final RlStressTestRepository stressTestRepository;
    private final RlStressTestDayRepository dayRepository;
    private final RlStressTestDayWeightRepository weightRepository;

    public RlStressTestPersistenceService(
            RlStressTestRepository stressTestRepository,
            RlStressTestDayRepository dayRepository,
            RlStressTestDayWeightRepository weightRepository
    ) {
        this.stressTestRepository = stressTestRepository;
        this.dayRepository = dayRepository;
        this.weightRepository = weightRepository;
    }

    @Transactional
    public RlStressTest save(
            User user,
            FundPortfolio fundPortfolio,
            RlInferenceResponse response
    ) {
        RlStressTest stressTest = RlStressTest.builder()
                .publicId(UUID.randomUUID())
                .user(user)
                .fundPortfolio(fundPortfolio)
                .model(response.model())
                .scenarioCode(response.scenario())
                .scenarioStartDate(response.scenarioStartDate())
                .scenarioEndDate(response.scenarioEndDate())
                .tradingDayCount(response.tradingDayCount())
                .initialNav(response.initialNav())
                .finalNav(response.finalNav())
                .returnPct(response.returnPct())
                .passiveFinalNav(response.passiveFinalNav())
                .passiveReturnPct(response.passiveReturnPct())
                .outperformanceAmount(response.outperformanceAmount())
                .outperformancePct(response.outperformancePct())
                .totalCommission(response.totalCommission())
                .createdAt(LocalDateTime.now())
                .build();

        stressTestRepository.save(stressTest);

        for (RlInferenceDay dayResponse : response.days()) {
            RlStressTestDay day = RlStressTestDay.builder()
                    .stressTest(stressTest)
                    .dayNumber(dayResponse.dayNumber())
                    .date(dayResponse.date())
                    .totalNewNav(dayResponse.totalNewNav())
                    .passiveNav(dayResponse.passiveNav())
                    .build();

            dayRepository.save(day);

            dayResponse.weights().forEach((assetCode, weight) -> {
                RlStressTestDayWeight dayWeight =
                        RlStressTestDayWeight.builder()
                                .day(day)
                                .assetCode(assetCode)
                                .weight(weight)
                                .build();

                weightRepository.save(dayWeight);
            });
        }

        return stressTest;
    }
}