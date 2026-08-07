package com.infina.portfoliomanagement.optimization.dto;

import com.infina.portfoliomanagement.optimization.enums.RequestStatus;
import com.infina.portfoliomanagement.optimization.enums.RiskProfile;

import java.time.LocalDateTime;

public record OptimizationRequestResponse(
        Long id,
        Long fundId,
        LocalDateTime dataTimestamp,
        String modelVersion,
        Long requestedByUserId,
        String requestedByUsername,
        RiskProfile riskProfile,
        RequestStatus status,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        String errorMessage,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
