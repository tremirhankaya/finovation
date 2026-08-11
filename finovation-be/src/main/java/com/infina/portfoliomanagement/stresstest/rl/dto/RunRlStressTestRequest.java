package com.infina.portfoliomanagement.stresstest.rl.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record RunRlStressTestRequest(

        @NotNull
        UUID fundId,

        @NotBlank
        String scenarioCode
) {
}