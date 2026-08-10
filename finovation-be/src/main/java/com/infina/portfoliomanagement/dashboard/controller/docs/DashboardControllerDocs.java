package com.infina.portfoliomanagement.dashboard.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.dashboard.dto.DashboardSummaryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.userdetails.UserDetails;

@Tag(
        name = "Dashboard",
        description = "Aggregated overview data for the authenticated user's dashboard."
)
public interface DashboardControllerDocs {

    @Operation(
            summary = "Get dashboard summary",
            description = "Returns fund, draft, optimization and stress test summaries for the authenticated user. "
                    + "Sections that could not be loaded are listed in unavailableSections.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    DashboardSummaryResponse getSummary(UserDetails userDetails);
}
