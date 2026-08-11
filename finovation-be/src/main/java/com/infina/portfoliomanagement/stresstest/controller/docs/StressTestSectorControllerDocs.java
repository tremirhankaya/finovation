package com.infina.portfoliomanagement.stresstest.controller.docs;

import com.infina.portfoliomanagement.stresstest.dto.response.StressTestSectorImpactResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestSectorPathResponse;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.UUID;

public interface StressTestSectorControllerDocs {

    @Operation(
            summary = "Sektör bazlı stres etkileri",
            description = "Tamamlanmış stres testi için sektör bazlı etki ve portföy katkılarını döner."
    )
    List<StressTestSectorImpactResponse> getSectorImpacts(
            UserDetails userDetails,
            UUID testId
    );

    @Operation(
            summary = "Sektör stres yolları",
            description = "Tamamlanmış stres testi için sektörlerin senaryo boyunca etki yollarını döner."
    )
    List<StressTestSectorPathResponse> getSectorPaths(
            UserDetails userDetails,
            UUID testId
    );
}