package com.infina.portfoliomanagement.stresstest.rl.repository;

import com.infina.portfoliomanagement.stresstest.rl.entity.RlStressTestDayWeight;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RlStressTestDayWeightRepository
        extends JpaRepository<RlStressTestDayWeight, Long> {

    List<RlStressTestDayWeight> findAllByDayId(
            Long dayId
    );
}