package com.infina.portfoliomanagement.optimization.dto;

import com.infina.portfoliomanagement.optimization.enums.RequestStatus;
import com.infina.portfoliomanagement.optimization.enums.RiskProfile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record OptimizationRequestResponse(
        Long id,
        UUID fundId,
        LocalDateTime dataTimestamp,
        String modelVersion,
        Long requestedByUserId,
        String requestedByUsername,
        RiskProfile riskProfile,
        RequestStatus status,
        Integer maxAdditions,
        BigDecimal tppMinWeight,
        BigDecimal tppMaxWeight,
        Integer stockCountMin,
        Integer stockCountMax,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        String errorMessage,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
