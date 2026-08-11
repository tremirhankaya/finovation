package com.infina.portfoliomanagement.systemlog.controller;

import com.infina.portfoliomanagement.systemlog.dto.SystemLogResponse;
import com.infina.portfoliomanagement.systemlog.service.SystemLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;

import java.util.List;

@RestController
@RequestMapping("/api/v1/system-logs")
@SecurityRequirement(name = "bearerAuth")
public class SystemLogController {

    private static final int DEFAULT_LIMIT = 200;
    private static final int MAX_LIMIT = 500;

    private final SystemLogService systemLogService;

    public SystemLogController(SystemLogService systemLogService) {
        this.systemLogService = systemLogService;
    }

    @GetMapping
    public ResponseEntity<List<SystemLogResponse>> getLogs(
            @RequestParam(required = false) String service,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "200") int limit
    ) {
        int safeLimit = Math.clamp(limit, 1, MAX_LIMIT);

        return ResponseEntity.ok(
                systemLogService.getLogs(
                        service,
                        level,
                        search,
                        safeLimit
                )
        );
    }
}