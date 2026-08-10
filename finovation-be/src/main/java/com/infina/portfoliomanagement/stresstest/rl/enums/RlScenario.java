package com.infina.portfoliomanagement.stresstest.rl.enums;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;

public enum RlScenario {

    IMAMOGLU(
            "S49_IMAMOGLU_POLITICAL_SHOCK_2025",
            "SCENARIO_1_2025_03_17"
    ),

    CHP_MUTLAK_BUTLAN(
            "S52_CHP_MUTLAK_BUTLAN_2025",
            "SCENARIO_2_2025_08_26"
    );

    private final String stressScenarioCode;
    private final String rlScenarioCode;

    RlScenario(
            String stressScenarioCode,
            String rlScenarioCode
    ) {
        this.stressScenarioCode = stressScenarioCode;
        this.rlScenarioCode = rlScenarioCode;
    }

    public String getStressScenarioCode() {
        return stressScenarioCode;
    }

    public String getRlScenarioCode() {
        return rlScenarioCode;
    }

    public static String toRlScenarioCode(String stressScenarioCode) {
        for (RlScenario scenario : values()) {
            if (scenario.stressScenarioCode.equals(stressScenarioCode)) {
                return scenario.rlScenarioCode;
            }
        }

        throw new BaseException(
                ErrorCode.STRESS_RL_SCENARIO_UNSUPPORTED
        );
    }
}