package com.infina.portfoliomanagement.optimization.controller;

import com.infina.portfoliomanagement.optimization.controller.docs.OptimizationRequestControllerDocs;
import com.infina.portfoliomanagement.optimization.dto.ApproveOptimizationRequestRequest;
import com.infina.portfoliomanagement.optimization.dto.CreateOptimizationRequestRequest;
import com.infina.portfoliomanagement.optimization.dto.OptimizationFundPositionsResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationLogEntryResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizableFundResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationRequestResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultResponse;
import com.infina.portfoliomanagement.optimization.service.OptimizationRequestService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/optimization-requests")
@RequiredArgsConstructor
public class OptimizationRequestController implements OptimizationRequestControllerDocs {

    private final OptimizationRequestService optimizationRequestService;

    @Override
    @GetMapping("/funds")
    public ResponseEntity<List<OptimizableFundResponse>> getOptimizableFunds(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(
                optimizationRequestService.listOptimizableFunds(userDetails.getUsername())
        );
    }

    @Override
    @PostMapping
    public ResponseEntity<OptimizationRequestResponse> createOptimizationRequest(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateOptimizationRequestRequest request
    ) {
        OptimizationRequestResponse response =
                optimizationRequestService.create(userDetails.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Override
    @GetMapping("/{id}")
    public ResponseEntity<OptimizationRequestResponse> getOptimizationRequest(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(
                optimizationRequestService.getById(userDetails.getUsername(), id)
        );
    }

    @Override
    @GetMapping
    public ResponseEntity<List<OptimizationRequestResponse>> getOptimizationRequests(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam UUID fundId
    ) {
        return ResponseEntity.ok(
                optimizationRequestService.listByFund(userDetails.getUsername(), fundId)
        );
    }

    @Override
    @GetMapping("/funds/{fundId}/current-positions")
    public ResponseEntity<OptimizationFundPositionsResponse> getCurrentPositions(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable UUID fundId
    ) {
        return ResponseEntity.ok(
                optimizationRequestService.getCurrentPositions(userDetails.getUsername(), fundId)
        );
    }

    @Override
    @GetMapping("/logs")
    public ResponseEntity<List<OptimizationLogEntryResponse>> getOptimizationLogs(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(
                optimizationRequestService.listLogs(userDetails.getUsername())
        );
    }

    @Override
    @PostMapping("/{id}/run")
    public ResponseEntity<OptimizationRequestResponse> runOptimizationRequest(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(
                optimizationRequestService.run(userDetails.getUsername(), id)
        );
    }

    @Override
    @GetMapping("/{id}/result")
    public ResponseEntity<OptimizationResultResponse> getOptimizationResult(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(
                optimizationRequestService.getResult(userDetails.getUsername(), id)
        );
    }

    @Override
    @PostMapping("/{id}/approve")
    public ResponseEntity<OptimizationRequestResponse> approveOptimizationRequest(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody(required = false) ApproveOptimizationRequestRequest request
    ) {
        return ResponseEntity.ok(
                optimizationRequestService.approve(userDetails.getUsername(), id, request)
        );
    }

    @Override
    @PostMapping("/{id}/reject")
    public ResponseEntity<OptimizationRequestResponse> rejectOptimizationRequest(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(
                optimizationRequestService.reject(userDetails.getUsername(), id)
        );
    }
}
