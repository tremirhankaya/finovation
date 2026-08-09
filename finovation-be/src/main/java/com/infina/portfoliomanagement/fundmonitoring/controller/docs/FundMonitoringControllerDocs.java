package com.infina.portfoliomanagement.fundmonitoring.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundSummaryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.UUID;

@Tag(
        name = "Fund monitoring",
        description = "Read-only fund valuation, performance, holding and sector views."
)
public interface FundMonitoringControllerDocs {

    @Operation(
            summary = "List visible completed funds",
            description = "Returns completed funds owned by the authenticated user. A company "
                    + "manager may provide ownerUserId to list a user in the same company.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    List<FundSummaryResponse> listFunds(UserDetails userDetails, Long ownerUserId);

    @Operation(
            summary = "Get a fund monitoring snapshot",
            description = "Values a createdAt-based, inception-weighted, buy-and-hold fund with "
                    + "historical equity closing prices and the configured temporary outstanding "
                    + "share count.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    FundMonitoringResponse getMonitoringSnapshot(
            UserDetails userDetails,
            UUID fundId
    );
}
