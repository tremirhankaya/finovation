package com.infina.portfoliomanagement.stresstest.repository;

import com.infina.portfoliomanagement.stresstest.entity.StressScenarioAssetShock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StressScenarioAssetShockRepository
        extends JpaRepository<StressScenarioAssetShock, Long> {

    List<StressScenarioAssetShock> findAllByScenarioId(Long scenarioId);
}