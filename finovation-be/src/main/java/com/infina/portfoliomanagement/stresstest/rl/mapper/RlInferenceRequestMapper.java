package com.infina.portfoliomanagement.stresstest.rl.mapper;

import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioPosition;
import com.infina.portfoliomanagement.stresstest.rl.dto.RlInferenceRequest;
import org.springframework.stereotype.Component;
import com.infina.portfoliomanagement.fund.enums.AIAssetCodeMapping;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class RlInferenceRequestMapper {

    private static final BigDecimal PERCENT_DIVISOR =
            BigDecimal.valueOf(100);

    public RlInferenceRequest map(
            String model,
            String scenario,
            BigDecimal initialNav,
            List<StressPortfolioPosition> positions
    ) {
        Map<String, BigDecimal> weights = new LinkedHashMap<>();

        for (StressPortfolioPosition position : positions) {

            String assetCode = position.assetCode();

            if (AIAssetCodeMapping.CASH_TPP.getInternalCode().equals(assetCode)) {
                assetCode = AIAssetCodeMapping.CASH_TPP.name();
            }

            weights.put(
                    assetCode,
                    position.weight()
                            .divide(
                                    PERCENT_DIVISOR,
                                    12,
                                    RoundingMode.HALF_UP
                            )
            );
        }

        return new RlInferenceRequest(
                model,
                scenario,
                initialNav,
                weights
        );
    }
}