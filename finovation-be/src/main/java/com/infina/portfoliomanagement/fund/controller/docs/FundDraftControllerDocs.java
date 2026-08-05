package com.infina.portfoliomanagement.fund.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;

@Tag(
        name = "Fund drafts",
        description = "Fund design flow. A draft is a decision support record, not an actual fund."
)
public interface FundDraftControllerDocs {

    @Operation(
            summary = "Start a fund draft",
            description = "Creates a fund draft from the initial portfolio size. "
                    + "Fund type, currency and investment universe are assigned by the system. "
                    + "Strategy preferences and portfolio limits are defined in the next step.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<FundDraftResponse> createDraft(
            UserDetails userDetails,
            CreateFundDraftRequest request
    );
}
