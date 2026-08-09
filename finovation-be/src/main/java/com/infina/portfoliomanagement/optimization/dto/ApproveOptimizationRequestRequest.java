package com.infina.portfoliomanagement.optimization.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.List;

public record ApproveOptimizationRequestRequest(
        @Valid List<AssetWeightOverride> weightOverrides
) {

    public record AssetWeightOverride(
            @NotBlank String assetCode,
            @NotNull @PositiveOrZero @DecimalMax("100") BigDecimal finalWeight
    ) {
    }
}
