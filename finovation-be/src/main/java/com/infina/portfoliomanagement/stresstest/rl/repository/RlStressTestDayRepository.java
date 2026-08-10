package com.infina.portfoliomanagement.stresstest.rl.repository;

import com.infina.portfoliomanagement.stresstest.rl.entity.RlStressTestDay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RlStressTestDayRepository
        extends JpaRepository<RlStressTestDay, Long> {

    List<RlStressTestDay> findAllByStressTestIdOrderByDayNumberAsc(
            Long stressTestId
    );
}