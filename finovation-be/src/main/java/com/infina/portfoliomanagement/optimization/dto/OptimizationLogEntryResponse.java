package com.infina.portfoliomanagement.optimization.dto;

import com.infina.portfoliomanagement.optimization.enums.RequestStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record OptimizationLogEntryResponse(
        Long requestId,
        UUID fundId,
        String fundName,
        String requestedByUsername,
        String requestedByDisplayName,
        Long decidedByUserId,
        String decidedByUsername,
        String decidedByDisplayName,
        RequestStatus status,
        String errorMessage,
        String rejectionReason,
        LocalDateTime createdAt,
        LocalDateTime completedAt,
        LocalDateTime updatedAt,
        boolean resultAvailable
) {
}
