package com.infina.portfoliomanagement.fund.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.fund.dto.ArchivedFundDraftResponse;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundDraftInitResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftPageResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftSummaryResponse;
import com.infina.portfoliomanagement.fund.dto.ModelUniverseAssetResponse;
import com.infina.portfoliomanagement.fund.dto.UpdateFundDraftPortfolioRulesRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.FundDraftAnalysisStateResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.SelectFundProposalRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.UpdateWorkingPortfolioRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.WorkingPortfolioResponse;
import com.infina.portfoliomanagement.fund.enums.FundDesignInitPage;
import com.infina.portfoliomanagement.fund.enums.FundDesignMode;
import com.infina.portfoliomanagement.fund.enums.FundDraftSortField;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.ManagementApproach;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
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
                    + "currentStep is set to 2 (Strategy). "
                    + "Profile constraints (equity/single-stock/sector caps) are written to "
                    + "fund_constraints. Strategy preferences and portfolio limits are defined "
                    + "in the next step.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<FundDraftResponse> createDraft(
            UserDetails userDetails,
            CreateFundDraftRequest request
    );

    @Operation(
            summary = "Get page-scoped fund draft init data",
            description = "Returns bootstrap data for one wizard page. "
                    + "page=START: currencies + create bounds + prospectus frames. "
                    + "page=STRATEGY&draftId=: portfolio-rule bounds + owned draft + model universe "
                    + "(single response for screen 2). "
                    + "page=ANALYSIS&draftId=: portfolio-rule bounds + owned draft + model universe "
                    + "(single response for screen 3). "
                    + "page=ALTERNATIVES|EDIT: prospectus / rule frames only. "
                    + "Save endpoints still enforce the same bounds.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundDraftInitResponse getInit(UserDetails userDetails, FundDesignInitPage page, UUID draftId);

    @Operation(
            summary = "Search the authenticated user's fund drafts",
            description = "Paginated list scoped to the caller. Filter by status "
                    + "(IN_PROGRESS for drafts, COMPLETED for funds), management approach, design mode and name. "
                    + "Archived drafts are never returned. currentStep is the next wizard screen "
                    + "to open for an in-progress draft. sortBy accepts NAME, INITIAL_PORTFOLIO_SIZE, "
                    + "CREATED_AT or UPDATED_AT; direction accepts ASC or DESC.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundDraftPageResponse searchDrafts(
            UserDetails userDetails,
            int page,
            int size,
            String q,
            FundDraftStatus status,
            ManagementApproach managementApproach,
            FundDesignMode designMode,
            FundDraftSortField sortBy,
            Sort.Direction direction
    );

    @Operation(
            summary = "List archived fund drafts",
            description = "Read-only history of the caller's archived drafts and funds. Archived "
                    + "records are hidden from every other query, so this endpoint reads them "
                    + "explicitly. They cannot be brought back.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    List<ArchivedFundDraftResponse> listArchivedDrafts(UserDetails userDetails);

    @Operation(
            summary = "Archive a fund draft",
            description = "Soft deletes the draft. It disappears from every list, from monitoring "
                    + "and from stress tests. The operation cannot be undone; the record stays "
                    + "readable only through the archive listing.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    void archiveDraft(UserDetails userDetails, UUID draftId);

    @Operation(
            summary = "List model universe equities",
            description = "Standalone universe list. Prefer page=STRATEGY init for screen 2 bootstrap.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    List<ModelUniverseAssetResponse> listModelUniverse();

    @Operation(
            summary = "Clone an archived draft",
            description = "Creates a new manual draft cloned from an archived draft.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundDraftResponse cloneDeletedDraft(UserDetails userDetails, UUID draftId, @Valid com.infina.portfoliomanagement.fund.dto.request.CloneDraftRequest request);

    @Operation(
            summary = "Pin or unpin a fund draft",
            description = "Toggles the pinned status of a fund draft.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    void updatePinStatus(UserDetails userDetails, UUID draftId, com.infina.portfoliomanagement.fund.dto.UpdateFundDraftPinRequest request);

    @Operation(
            summary = "Get a fund draft",
            description = "Returns the draft owned by the authenticated user. "
                    + "Strategy fields may still be empty until that step is saved. "
                    + "Includes excluded and forced asset codes when preferences exist.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundDraftResponse getDraft(UserDetails userDetails, UUID draftId);

    @Operation(
            summary = "Save portfolio rules (screen 2)",
            description = "Persists management approach, TPP range/preferred value, stock-count "
                    + "range, and optional excluded/forced equities. Equity and single-stock caps "
                    + "are stamped from the design profile into fund_drafts and fund_constraints. "
                    + "Advances currentStep to 3 (AI Analizi) when appropriate.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundDraftResponse updatePortfolioRules(
            UserDetails userDetails,
            UUID draftId,
            UpdateFundDraftPortfolioRulesRequest request
    );

    @Operation(
            summary = "Get persisted analysis state",
            description = "Returns proposals for the current rules fingerprint from SQL "
                    + "(model_runs / fund_portfolios). Empty proposals means analysis was not run "
                    + "yet or rules changed.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundDraftAnalysisStateResponse getAnalysisState(UserDetails userDetails, UUID draftId);

    @Operation(
            summary = "Run AI analysis (screen 3)",
            description = "If a COMPLETED model_run already matches the current rules fingerprint, "
                    + "returns those proposals without re-running. Otherwise creates a model_run, "
                    + "persists PROPOSAL portfolios/positions, and advances currentStep to 4.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundModelAnalysisResponse runAnalysis(UserDetails userDetails, UUID draftId);

    @Operation(
            summary = "Select a proposal (screen 4)",
            description = "Marks the proposal as selected and copies positions into the WORKING "
                    + "portfolio. Advances currentStep to 5 (Edit).",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundDraftAnalysisStateResponse selectProposal(
            UserDetails userDetails,
            UUID draftId,
            SelectFundProposalRequest request
    );

    @Operation(
            summary = "Get working portfolio (screen 5)",
            description = "Returns the WORKING portfolio positions for the draft.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    WorkingPortfolioResponse getWorkingPortfolio(UserDetails userDetails, UUID draftId);

    @Operation(
            summary = "Update working portfolio (screen 5)",
            description = "Replaces WORKING portfolio positions (autosave / continue).",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    WorkingPortfolioResponse updateWorkingPortfolio(
            UserDetails userDetails,
            UUID draftId,
            UpdateWorkingPortfolioRequest request
    );

    @Operation(
            summary = "Complete the fund draft (screen 6)",
            description = "Revalidates the working portfolio against the fund rules, then marks "
                    + "the draft COMPLETED. A completed draft can no longer be changed.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundDraftResponse completeDraft(UserDetails userDetails, UUID draftId);
}
