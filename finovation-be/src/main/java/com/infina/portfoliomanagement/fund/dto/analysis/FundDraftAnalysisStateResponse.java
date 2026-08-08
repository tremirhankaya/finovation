package com.infina.portfoliomanagement.fund.dto.analysis;

import java.util.List;

public record FundDraftAnalysisStateResponse(
        String rulesFingerprint,
        List<FundModelProposalDto> proposals,
        Integer selectedRank
) {
}
