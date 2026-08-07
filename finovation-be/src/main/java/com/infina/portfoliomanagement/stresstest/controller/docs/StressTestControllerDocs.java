package com.infina.portfoliomanagement.stresstest.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.stresstest.dto.request.RunStressTestRequest;
import com.infina.portfoliomanagement.stresstest.dto.response.RunStressTestResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestDetailResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestHistoryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.UUID;

@Tag(
        name = "Stress tests",
        description = "Portfolio stress test operations."
)
public interface StressTestControllerDocs {

    @Operation(
            summary = "Run a stress test",
            description = "Runs the selected predefined stress scenario against the authenticated user's selected portfolio.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<RunStressTestResponse> runStressTest(
            UserDetails userDetails,
            RunStressTestRequest request
    );

    @Operation(
            summary = "List stress test history",
            description = "Returns completed and non-deleted stress tests of the authenticated user.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<List<StressTestHistoryResponse>> getHistory(
            UserDetails userDetails
    );

    @Operation(
            summary = "Get stress test detail",
            description = "Returns the detail and portfolio snapshot of a completed stress test.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<StressTestDetailResponse> getDetail(
            UserDetails userDetails,
            UUID testId
    );

    @Operation(
            summary = "Delete stress test",
            description = "Removes a stress test from the authenticated user's history.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<Void> deleteStressTest(
            UserDetails userDetails,
            UUID testId
    );
}