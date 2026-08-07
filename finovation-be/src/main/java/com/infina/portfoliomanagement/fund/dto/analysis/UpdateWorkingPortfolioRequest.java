package com.infina.portfoliomanagement.fund.dto.analysis;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record UpdateWorkingPortfolioRequest(
        @NotEmpty
        @Valid
        List<FundModelAssetDto> assets
) {
}
