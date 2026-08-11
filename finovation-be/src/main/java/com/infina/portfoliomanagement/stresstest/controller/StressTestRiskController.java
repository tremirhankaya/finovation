package com.infina.portfoliomanagement.stresstest.controller;

import com.infina.portfoliomanagement.stresstest.controller.docs.StressTestRiskControllerDocs;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestRiskMetricsResponse;
import com.infina.portfoliomanagement.stresstest.service.StressTestRiskService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stress-tests")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class StressTestRiskController implements StressTestRiskControllerDocs {

    private final StressTestRiskService stressTestRiskService;

    @Override
    @GetMapping("/{testId}/risk-metrics")
    public StressTestRiskMetricsResponse getRiskMetrics(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID testId
    ) {
        return stressTestRiskService.getRiskMetrics(
                userDetails.getUsername(),
                testId
        );
    }
}