package com.infina.portfoliomanagement.stresstest.rl.controller;

import com.infina.portfoliomanagement.stresstest.rl.dto.RlInferenceResponse;
import com.infina.portfoliomanagement.stresstest.rl.dto.RunRlStressTestRequest;
import com.infina.portfoliomanagement.stresstest.rl.dto.response.RlStressTestDetailResponse;
import com.infina.portfoliomanagement.stresstest.rl.dto.response.RlStressTestHistoryResponse;
import com.infina.portfoliomanagement.stresstest.rl.service.RlStressTestQueryService;
import com.infina.portfoliomanagement.stresstest.rl.service.RlStressTestService;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stress-tests/rl")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class RlStressTestController {

    private final RlStressTestService rlStressTestService;
    private final RlStressTestQueryService queryService;

    @PostMapping
    public ResponseEntity<RlInferenceResponse> run(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody RunRlStressTestRequest request
    ) {
        return ResponseEntity.ok(
                rlStressTestService.run(
                        userDetails.getUsername(),
                        request.fundId(),
                        request.scenarioCode()
                )
        );
    }

    @GetMapping("/history")
    public ResponseEntity<List<RlStressTestHistoryResponse>> getHistory(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(
                queryService.getHistory(
                        userDetails.getUsername()
                )
        );
    }

    @GetMapping("/{testId}")
    public ResponseEntity<RlStressTestDetailResponse> getDetail(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID testId
    ) {
        return ResponseEntity.ok(
                queryService.getDetail(
                        userDetails.getUsername(),
                        testId
                )
        );
    }
}