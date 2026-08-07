package com.infina.portfoliomanagement.optimization.dto;

import com.infina.portfoliomanagement.optimization.enums.AssetPreferenceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record AssetPreferenceRequest(

        @NotBlank(message = "Asset code must not be blank.")
        String assetCode,

        @NotNull(message = "Preference type must not be null.")
        AssetPreferenceType preferenceType,

        BigDecimal currentWeight

) {
}
