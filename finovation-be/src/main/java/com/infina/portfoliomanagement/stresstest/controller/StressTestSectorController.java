package com.infina.portfoliomanagement.stresstest.controller;

import com.infina.portfoliomanagement.stresstest.controller.docs.StressTestSectorControllerDocs;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestSectorImpactResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestSectorPathResponse;
import com.infina.portfoliomanagement.stresstest.service.StressTestSectorService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stress-tests")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class StressTestSectorController implements StressTestSectorControllerDocs {

    private final StressTestSectorService stressTestSectorService;

    @Override
    @GetMapping("/{testId}/sectors")
    public List<StressTestSectorImpactResponse> getSectorImpacts(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID testId
    ) {
        return stressTestSectorService.getSectorImpacts(
                userDetails.getUsername(),
                testId
        );
    }

    @Override
    @GetMapping("/{testId}/sector-paths")
    public List<StressTestSectorPathResponse> getSectorPaths(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID testId
    ) {
        return stressTestSectorService.getSectorPaths(
                userDetails.getUsername(),
                testId
        );
    }
}