package com.infina.portfoliomanagement.fund.controller;

import com.infina.portfoliomanagement.fund.controller.docs.FundDraftControllerDocs;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundDraftInitResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftSummaryResponse;
import com.infina.portfoliomanagement.fund.dto.FundEstimatesResponse;
import com.infina.portfoliomanagement.fund.dto.ModelUniverseAssetResponse;
import com.infina.portfoliomanagement.fund.dto.UpdateFundDraftPortfolioRulesRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.FundDraftAnalysisStateResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.SelectFundProposalRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.UpdateWorkingPortfolioRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.WorkingPortfolioResponse;
import com.infina.portfoliomanagement.fund.enums.FundDesignInitPage;
import com.infina.portfoliomanagement.fund.service.FundDraftService;
import com.infina.portfoliomanagement.fund.service.FundEstimationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/fund-drafts")
@RequiredArgsConstructor
public class FundDraftController implements FundDraftControllerDocs {

    private final FundDraftService fundDraftService;
    private final FundEstimationService fundEstimationService;

    @Override
    @PostMapping
    public ResponseEntity<FundDraftResponse> createDraft(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateFundDraftRequest request
    ) {
        FundDraftResponse response =
                fundDraftService.createDraft(userDetails.getUsername(), request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Override
    @GetMapping("/init")
    public FundDraftInitResponse getInit(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam FundDesignInitPage page,
            @RequestParam(required = false) UUID draftId
    ) {
        return fundDraftService.getInit(userDetails.getUsername(), page, draftId);
    }

    @Override
    @GetMapping
    public List<FundDraftSummaryResponse> listInProgressDrafts(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return fundDraftService.listInProgressDrafts(userDetails.getUsername());
    }

    @Override
    @GetMapping("/completed")
    public List<FundDraftSummaryResponse> listCompletedDrafts(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return fundDraftService.listCompletedDrafts(userDetails.getUsername());
    }

    @Override
    @GetMapping("/model-universe")
    public List<ModelUniverseAssetResponse> listModelUniverse() {
        return fundDraftService.listModelUniverse();
    }

    @Override
    @GetMapping("/{draftId}")
    public FundDraftResponse getDraft(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID draftId
    ) {
        return fundDraftService.getDraft(userDetails.getUsername(), draftId);
    }

    @Override
    @PutMapping("/{draftId}/portfolio-rules")
    public FundDraftResponse updatePortfolioRules(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID draftId,
            @Valid @RequestBody UpdateFundDraftPortfolioRulesRequest request
    ) {
        return fundDraftService.updatePortfolioRules(
                userDetails.getUsername(),
                draftId,
                request
        );
    }

    @Override
    @GetMapping("/{draftId}/analysis")
    public FundDraftAnalysisStateResponse getAnalysisState(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID draftId
    ) {
        return fundDraftService.getAnalysisState(userDetails.getUsername(), draftId);
    }

    @Override
    @PostMapping("/{draftId}/analysis")
    public FundModelAnalysisResponse runAnalysis(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID draftId
    ) {
        return fundDraftService.runAnalysis(userDetails.getUsername(), draftId);
    }

    @Override
    @PutMapping("/{draftId}/selected-proposal")
    public FundDraftAnalysisStateResponse selectProposal(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID draftId,
            @Valid @RequestBody SelectFundProposalRequest request
    ) {
        return fundDraftService.selectProposal(
                userDetails.getUsername(),
                draftId,
                request.rank()
        );
    }

    @Override
    @GetMapping("/{draftId}/working-portfolio")
    public WorkingPortfolioResponse getWorkingPortfolio(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID draftId
    ) {
        return fundDraftService.getWorkingPortfolio(userDetails.getUsername(), draftId);
    }

    @Override
    @PutMapping("/{draftId}/working-portfolio")
    public WorkingPortfolioResponse updateWorkingPortfolio(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID draftId,
            @Valid @RequestBody UpdateWorkingPortfolioRequest request
    ) {
        return fundDraftService.updateWorkingPortfolio(
                userDetails.getUsername(),
                draftId,
                request.assets()
        );
    }

    @Override
    @PostMapping("/{draftId}/completion")
    public FundDraftResponse completeDraft(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID draftId
    ) {
        return fundDraftService.completeDraft(userDetails.getUsername(), draftId);
    }

    @GetMapping("/{draftId}/estimates")
    public FundEstimatesResponse getEstimates(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable java.util.UUID draftId
    ) {
        return fundEstimationService.estimateDraft(userDetails.getUsername(), draftId);
    }
}
