package com.infina.portfoliomanagement.fund.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateFundDraftPinRequest(
        @NotNull(message = "pinned field is required")
        Boolean pinned
) {
}
