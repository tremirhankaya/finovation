package com.infina.portfoliomanagement.dashboard.controller;

import com.infina.portfoliomanagement.dashboard.controller.docs.DashboardControllerDocs;
import com.infina.portfoliomanagement.dashboard.dto.DashboardSummaryResponse;
import com.infina.portfoliomanagement.dashboard.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController implements DashboardControllerDocs {

    private final DashboardService dashboardService;

    @Override
    @GetMapping("/summary")
    public DashboardSummaryResponse getSummary(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return dashboardService.getSummary(userDetails.getUsername());
    }
}
