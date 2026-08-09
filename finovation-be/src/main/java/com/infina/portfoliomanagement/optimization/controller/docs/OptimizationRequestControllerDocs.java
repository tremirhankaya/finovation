package com.infina.portfoliomanagement.optimization.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.optimization.dto.ApproveOptimizationRequestRequest;
import com.infina.portfoliomanagement.optimization.dto.CreateOptimizationRequestRequest;
import com.infina.portfoliomanagement.optimization.dto.OptimizationLogEntryResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizableFundResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationRequestResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultResponse;
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
            summary = "List optimizable funds",
            description = "Returns the actor's own COMPLETED funds with an at-a-glance summary for the " +
                    "optimization fund-selection step: current stock/sector count, equity/TPP weight split " +
                    "(from the fund's currently selected portfolio) and the date of the fund's most recent " +
                    "completed optimization run, if any.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<List<OptimizableFundResponse>> getOptimizableFunds(UserDetails userDetails);

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
            summary = "List the actor's optimization audit log",
            description = "Returns every optimization request the actor has made, across all funds, " +
                    "newest first, for the 'İşlem Logları' audit screen. ADMIN receives every request " +
                    "from every user; other actors receive only their own.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<List<OptimizationLogEntryResponse>> getOptimizationLogs(UserDetails userDetails);

    @Operation(
            summary = "Run optimization request",
            description = "Sends the request's constraints, asset preferences and asset limit overrides " +
                    "to the AR-GE optimization engine. Only requests in PREPARING or FAILED status can be " +
                    "run.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<OptimizationRequestResponse> runOptimizationRequest(UserDetails userDetails, Long id);

    @Operation(
            summary = "Get optimization result",
            description = "Returns the per-asset proposed portfolio for a completed optimization request " +
                    "(current/proposed/final weights, action type and rationale). Weights are expressed as " +
                    "percentages (0-100). Returns 404 if the request has not produced a result yet.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<OptimizationResultResponse> getOptimizationResult(UserDetails userDetails, Long id);

    @Operation(
            summary = "Approve optimization request",
            description = "Approves a COMPLETED optimization request. Directly updates the fund's active " +
                    "portfolio with the proposed weights (GK-02) and records the approval on the " +
                    "optimization result for audit and reporting purposes (GK-03). An optional list of " +
                    "per-asset final weight overrides may be supplied; assets without an override keep the " +
                    "engine's proposed weight.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<OptimizationRequestResponse> approveOptimizationRequest(
            UserDetails userDetails,
            Long id,
            ApproveOptimizationRequestRequest request
    );

    @Operation(
            summary = "Reject optimization request",
            description = "Rejects a COMPLETED optimization request.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    ResponseEntity<OptimizationRequestResponse> rejectOptimizationRequest(UserDetails userDetails, Long id);
}
