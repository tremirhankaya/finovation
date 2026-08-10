package com.infina.portfoliomanagement.optimization.dto;

import jakarta.validation.constraints.Size;

public record RejectOptimizationRequestRequest(
        @Size(max = 500) String reason
) {
}
