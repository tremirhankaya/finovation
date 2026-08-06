package com.infina.portfoliomanagement.fund.controller;

import com.infina.portfoliomanagement.fund.controller.docs.FundDraftControllerDocs;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundDraftInitResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import com.infina.portfoliomanagement.fund.service.FundDraftService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/fund-drafts")
@RequiredArgsConstructor
public class FundDraftController implements FundDraftControllerDocs {

    private final FundDraftService fundDraftService;

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
    public FundDraftInitResponse getInit() {
        return fundDraftService.getInit();
    }

    @Override
    @GetMapping("/{draftId}")
    public FundDraftResponse getDraft(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID draftId
    ) {
        return fundDraftService.getDraft(userDetails.getUsername(), draftId);
    }
}
