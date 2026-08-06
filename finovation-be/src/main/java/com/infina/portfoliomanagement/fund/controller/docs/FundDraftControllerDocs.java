package com.infina.portfoliomanagement.fund.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundDraftInitResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.UUID;

@Tag(
        name = "Fund drafts",
        description = "Fund design flow. A draft is a decision support record, not an actual fund."
)
public interface FundDraftControllerDocs {

    @Operation(
            summary = "Start a fund draft",
            description = "Creates a fund draft from the fund name, initial portfolio size and unit price. "
                    + "Fund type, currency and investment universe are assigned by the system. "
                    + "Strategy preferences and portfolio limits are defined in the next step.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<FundDraftResponse> createDraft(
            UserDetails userDetails,
            CreateFundDraftRequest request
    );

    @Operation(
            summary = "Get fund draft init data",
            description = "Returns supported currencies plus configured bounds for screen 1 "
                    + "(portfolio size, unit price) and screen 2 portfolio rules "
                    + "(liquidity/TPP, stock count, equity weight, single-stock max, sector cap). "
                    + "Save endpoints still enforce the same bounds.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundDraftInitResponse getInit();

    @Operation(
            summary = "Get a fund draft",
            description = "Returns the draft owned by the authenticated user. "
                    + "Strategy fields may still be empty until that step is saved.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundDraftResponse getDraft(UserDetails userDetails, UUID draftId);
}
