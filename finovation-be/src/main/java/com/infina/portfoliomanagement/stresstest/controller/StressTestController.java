package com.infina.portfoliomanagement.stresstest.controller;

import com.infina.portfoliomanagement.stresstest.controller.docs.StressTestControllerDocs;
import com.infina.portfoliomanagement.stresstest.dto.request.RunStressTestRequest;
import com.infina.portfoliomanagement.stresstest.dto.response.RunStressTestResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestDetailResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestHistoryResponse;
import com.infina.portfoliomanagement.stresstest.service.StressTestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stress-tests")
@RequiredArgsConstructor
public class StressTestController implements StressTestControllerDocs {

    private final StressTestService stressTestService;

    @Override
    @PostMapping
    public ResponseEntity<RunStressTestResponse> runStressTest(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody RunStressTestRequest request
    ) {
        RunStressTestResponse response =
                stressTestService.runStressTest(
                        userDetails.getUsername(),
                        request
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @Override
    @GetMapping
    public ResponseEntity<List<StressTestHistoryResponse>> getHistory(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(
                stressTestService.getHistory(userDetails.getUsername())
        );
    }

    @Override
    @GetMapping("/{testId}")
    public ResponseEntity<StressTestDetailResponse> getDetail(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID testId
    ) {
        return ResponseEntity.ok(
                stressTestService.getDetail(
                        userDetails.getUsername(),
                        testId
                )
        );
    }

    @Override
    @DeleteMapping("/{testId}")
    public ResponseEntity<Void> deleteStressTest(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID testId
    ) {
        stressTestService.deleteStressTest(
                userDetails.getUsername(),
                testId
        );

        return ResponseEntity.noContent().build();
    }
}