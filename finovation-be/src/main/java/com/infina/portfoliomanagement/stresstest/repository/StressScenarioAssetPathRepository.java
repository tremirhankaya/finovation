package com.infina.portfoliomanagement.stresstest.repository;

import com.infina.portfoliomanagement.stresstest.entity.StressScenarioAssetPath;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StressScenarioAssetPathRepository
        extends JpaRepository<StressScenarioAssetPath, Long> {

    List<StressScenarioAssetPath> findAllByScenarioIdOrderByDayIndexAsc(
            Long scenarioId
    );
    List<StressScenarioAssetPath>
    findAllByScenarioIdAndAssetIdOrderByDayIndexAsc(
            Long scenarioId,
            Long assetId
    );

    List<StressScenarioAssetPath>
    findAllByScenarioIdAndAssetIdInOrderByDayIndexAsc(
            Long scenarioId,
            List<Long> assetIds
    );
}