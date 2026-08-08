package com.infina.portfoliomanagement.optimization.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.optimization.dto.InvestmentUniverseAssetResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.List;

@Tag(
        name = "Investment Universe",
        description = "Read-only access to the active, model-eligible equity universe used by the " +
                "optimization module's asset exclude/force-add constraint panels."
)
@SuppressWarnings("unused") // Endpoints are invoked by Spring through their controller implementations.
public interface InvestmentUniverseControllerDocs {

    @Operation(
            summary = "List investment universe",
            description = "Returns every active equity asset flagged as part of the optimization model " +
                    "universe, with its sector name, ordered by asset code.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    List<InvestmentUniverseAssetResponse> listInvestmentUniverse();
}
