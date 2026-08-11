package com.infina.portfoliomanagement.stresstest.controller;

import com.infina.portfoliomanagement.stresstest.controller.docs.StressTestPathControllerDocs;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestAssetPathResponse;
import com.infina.portfoliomanagement.stresstest.service.StressTestPathService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestPortfolioPathResponse;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stress-tests")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class StressTestPathController implements StressTestPathControllerDocs {

    private final StressTestPathService stressTestPathService;

    @Override
    @GetMapping("/{testId}/path/{assetCode}")
    public StressTestAssetPathResponse getAssetPath(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID testId,
            @PathVariable String assetCode
    ) {
        return stressTestPathService.getAssetPath(
                userDetails.getUsername(),
                testId,
                assetCode
        );
    }

    @Override
    @GetMapping("/{testId}/portfolio-path")
    public StressTestPortfolioPathResponse getPortfolioPath(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID testId
    ) {
        return stressTestPathService.getPortfolioPath(
                userDetails.getUsername(),
                testId
        );
    }
}