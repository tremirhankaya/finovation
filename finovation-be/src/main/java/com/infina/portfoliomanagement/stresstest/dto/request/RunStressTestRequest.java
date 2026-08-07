package com.infina.portfoliomanagement.stresstest.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record RunStressTestRequest(

        @NotNull
        UUID fundId,

        @NotBlank
        String scenarioCode

) {
}