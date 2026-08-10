package com.infina.portfoliomanagement.fundmonitoring.controller;

import com.infina.portfoliomanagement.fundmonitoring.controller.docs.FundMonitoringControllerDocs;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundSummaryResponse;
import com.infina.portfoliomanagement.fundmonitoring.service.FundMonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/funds")
@RequiredArgsConstructor
public class FundMonitoringController implements FundMonitoringControllerDocs {

    private final FundMonitoringService fundMonitoringService;

    @Override
    @GetMapping
    public List<FundSummaryResponse> listFunds(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) Long ownerUserId
    ) {
        return fundMonitoringService.listFunds(
                userDetails.getUsername(),
                ownerUserId
        );
    }

    @Override
    @GetMapping("/{fundId}/monitoring")
    public FundMonitoringResponse getMonitoringSnapshot(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID fundId
    ) {
        return fundMonitoringService.getMonitoringSnapshot(
                userDetails.getUsername(),
                fundId
        );
    }
}
