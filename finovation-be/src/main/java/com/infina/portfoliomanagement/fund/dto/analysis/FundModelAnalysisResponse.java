package com.infina.portfoliomanagement.fund.dto.analysis;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record FundModelAnalysisResponse(
        @JsonProperty("proposals")
        List<FundModelProposalDto> proposals
) {}
