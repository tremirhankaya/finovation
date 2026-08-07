package com.infina.portfoliomanagement.stresstest.repository;

import com.infina.portfoliomanagement.stresstest.entity.StressTestPositionSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StressTestPositionSnapshotRepository
        extends JpaRepository<StressTestPositionSnapshot, Long> {

    List<StressTestPositionSnapshot> findAllByStressTestIdOrderByWeightDesc(
            Long stressTestId
    );
}