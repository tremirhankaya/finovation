package com.infina.portfoliomanagement.stresstest.controller.docs;

import com.infina.portfoliomanagement.common.config.OpenApiConfig;
import com.infina.portfoliomanagement.stresstest.dto.response.StressScenarioResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.List;

@Tag(
        name = "Stress scenarios",
        description = "Predefined stress scenarios available for portfolio stress testing."
)
public interface StressScenarioControllerDocs {

    @Operation(
            summary = "List active stress scenarios",
            description = "Returns active predefined stress scenarios ordered for display.",
            security = @SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
    )
    List<StressScenarioResponse> listScenarios();
}