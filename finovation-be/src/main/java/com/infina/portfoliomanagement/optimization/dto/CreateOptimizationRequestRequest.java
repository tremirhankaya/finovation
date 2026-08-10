package com.infina.portfoliomanagement.optimization.dto;

import com.infina.portfoliomanagement.optimization.enums.RiskProfile;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateOptimizationRequestRequest(

        @NotNull(message = "Fund id must not be null.")
        UUID fundId,

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
        Integer stockCountMax,

        @NotNull(message = "Maximum additions must not be null.")
        @Min(value = 0, message = "Maximum additions must be at least 0.")
        @Max(value = 30, message = "Maximum additions must be at most 30.")
        Integer maxAdditions

) {
}
