package com.infina.portfoliomanagement.fund.dto.analysis;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SelectFundProposalRequest(
        @NotNull
        @Min(1)
        Integer rank
) {
}
