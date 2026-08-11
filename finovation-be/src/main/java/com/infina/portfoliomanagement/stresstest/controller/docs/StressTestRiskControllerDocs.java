package com.infina.portfoliomanagement.stresstest.controller.docs;

import com.infina.portfoliomanagement.stresstest.dto.response.StressTestRiskMetricsResponse;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.UUID;

public interface StressTestRiskControllerDocs {

    @Operation(
            summary = "Stres testi risk metrikleri",
            description = "Tamamlanmış stres testi için portföy risk metriklerini döner."
    )
    StressTestRiskMetricsResponse getRiskMetrics(
            UserDetails userDetails,
            UUID testId
    );
}