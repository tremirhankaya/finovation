package com.infina.portfoliomanagement.fund.dto.analysis;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;


public record FundModelProposalDto(
        @JsonProperty("rank")
        Integer rank,

        @JsonProperty("label")
        String label,

        @JsonProperty("assets")
        List<FundModelAssetDto> assets
) {
}
