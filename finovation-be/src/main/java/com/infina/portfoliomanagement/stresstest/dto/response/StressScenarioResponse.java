package com.infina.portfoliomanagement.stresstest.dto.response;

import com.infina.portfoliomanagement.stresstest.entity.StressScenario;

public record StressScenarioResponse(
        String code,
        String name,
        String description
) {

    public static StressScenarioResponse from(StressScenario scenario) {
        return new StressScenarioResponse(
                scenario.getCode(),
                scenario.getName(),
                scenario.getDescription()
        );
    }
}