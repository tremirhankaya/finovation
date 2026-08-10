package com.infina.portfoliomanagement.stresstest.engine;

import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioSnapshot;
import com.infina.portfoliomanagement.stresstest.dto.StressTestComputationResult;
import com.infina.portfoliomanagement.stresstest.entity.StressScenario;

public interface StressTestEngine {

    StressTestComputationResult calculate(
            StressScenario scenario,
            StressPortfolioSnapshot portfolio
    );
}