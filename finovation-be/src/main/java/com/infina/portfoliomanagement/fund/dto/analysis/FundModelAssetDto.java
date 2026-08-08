package com.infina.portfoliomanagement.fund.dto.analysis;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record FundModelAssetDto(
        @JsonProperty("asset_code")
        @NotBlank
        String assetCode,

        @JsonProperty("weight")
        @NotNull
        @DecimalMin("0")
        @DecimalMax("100")
        BigDecimal weight,

        @JsonProperty("ai_note")
        String aiNote
) {
}
