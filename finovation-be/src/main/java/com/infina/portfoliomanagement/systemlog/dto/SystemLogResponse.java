package com.infina.portfoliomanagement.systemlog.dto;

import java.time.Instant;

public record SystemLogResponse(
        Instant timestamp,
        String level,
        String service,
        String message
) {
}