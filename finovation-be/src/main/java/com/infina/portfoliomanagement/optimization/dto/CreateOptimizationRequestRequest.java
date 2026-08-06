package com.infina.portfoliomanagement.optimization.dto;

import com.infina.portfoliomanagement.optimization.enums.RiskProfile;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record CreateOptimizationRequestRequest(

        @NotNull(message = "Fund id must not be null.")
        Long fundId,

        @NotNull(message = "Risk profile must not be null.")
        RiskProfile riskProfile,

        @Valid
        List<AssetPreferenceRequest> assetPreferences,

        @NotNull(message = "TPP minimum weight must not be null.")
        BigDecimal tppMinWeight,

        @NotNull(message = "TPP maximum weight must not be null.")
        BigDecimal tppMaxWeight,

        @NotNull(message = "Stock count minimum must not be null.")
        Integer stockCountMin,

        @NotNull(message = "Stock count maximum must not be null.")
        Integer stockCountMax

) {
}
