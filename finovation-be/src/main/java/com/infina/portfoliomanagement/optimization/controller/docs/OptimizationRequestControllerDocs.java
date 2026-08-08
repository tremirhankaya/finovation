package com.infina.portfoliomanagement.optimization.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.optimization.dto.CreateOptimizationRequestRequest;
import com.infina.portfoliomanagement.optimization.dto.OptimizationRequestResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.UUID;

@Tag(
        name = "Optimization Requests",
        description = "Create, read, run and approve/reject operations for optimization scenario requests."
)
@SuppressWarnings("unused") // Endpoints are invoked by Spring through their controller implementations.
public interface OptimizationRequestControllerDocs {

    @Operation(
            summary = "Create optimization request",
            description = "Creates a new optimization scenario for a fund. Equity weight (85-95), sector " +
                    "concentration (30) and single stock maximum weight (10) limits are fixed by the fund " +
                    "prospectus and applied automatically. TPP weight range must stay within 5-15 with a " +
                    "minimum width of 3, and stock count range within 16-35 with a minimum width of 5.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<OptimizationRequestResponse> createOptimizationRequest(
            UserDetails userDetails,
            CreateOptimizationRequestRequest request
    );

    @Operation(
            summary = "Get optimization request",
            description = "Returns a single optimization request. ADMIN may access any request; " +
                    "other actors may only access requests they created.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<OptimizationRequestResponse> getOptimizationRequest(UserDetails userDetails, Long id);

    @Operation(
            summary = "List optimization requests for a fund",
            description = "Returns optimization requests for the given fund. ADMIN receives all " +
                    "requests for the fund; other actors receive only the requests they created.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<List<OptimizationRequestResponse>> getOptimizationRequests(
            UserDetails userDetails,
            UUID fundId
    );

    @Operation(
            summary = "Run optimization request",
            description = "Sends the request's constraints, asset preferences and asset limit overrides " +
                    "to the AR-GE optimization engine. Only requests in PREPARING or FAILED status can be " +
                    "run.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<OptimizationRequestResponse> runOptimizationRequest(UserDetails userDetails, Long id);

    @Operation(
            summary = "Approve optimization request",
            description = "Approves a COMPLETED optimization request.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<OptimizationRequestResponse> approveOptimizationRequest(UserDetails userDetails, Long id);

    @Operation(
            summary = "Reject optimization request",
            description = "Rejects a COMPLETED optimization request.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<OptimizationRequestResponse> rejectOptimizationRequest(UserDetails userDetails, Long id);
}
