package com.infina.portfoliomanagement.stresstest.controller.docs;

import com.infina.portfoliomanagement.stresstest.dto.response.StressTestAssetPathResponse;
import com.infina.portfoliomanagement.stresstest.dto.response.StressTestPortfolioPathResponse;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.UUID;

public interface StressTestPathControllerDocs {

    @Operation(
            summary = "Varlık stres yolu",
            description = "Tamamlanmış stres testi için belirli bir varlığın senaryo boyunca oluşan değer ve etki yolunu döner."
    )
    StressTestAssetPathResponse getAssetPath(
            UserDetails userDetails,
            UUID testId,
            String assetCode
    );

    @Operation(
            summary = "Portföy stres yolu",
            description = "Tamamlanmış stres testi için portföyün senaryo boyunca agregat etki yolunu döner."
    )
    StressTestPortfolioPathResponse getPortfolioPath(
            UserDetails userDetails,
            UUID testId
    );
}