package com.infina.portfoliomanagement.stresstest.rl.validation;

import com.infina.portfoliomanagement.stresstest.dto.StressPortfolioPosition;
import org.springframework.stereotype.Component;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class RlPortfolioValidator {

    private static final String CASH_TPP = "TPP1G";
    private static final Set<String> SUPPORTED_ASSETS = Set.of(
            "GARAN.E",
            "AKBNK.E",
            "ASELS.E",
            "BIMAS.E",
            "TUPRS.E",
            "THYAO.E",
            "FROTO.E",
            "KCHOL.E",
            "SAHOL.E",
            "SISE.E",
            "EREGL.E",
            "TCELL.E",
            "TAVHL.E",
            "MGROS.E",
            "TOASO.E",
            "ULKER.E",
            CASH_TPP
    );

    private static final BigDecimal TOTAL_WEIGHT = BigDecimal.valueOf(100);
    private static final BigDecimal MIN_EQUITY_WEIGHT = BigDecimal.valueOf(3);
    private static final BigDecimal MAX_EQUITY_WEIGHT = BigDecimal.valueOf(10);
    private static final BigDecimal MIN_TPP_WEIGHT = BigDecimal.valueOf(5);
    private static final BigDecimal MAX_TPP_WEIGHT = BigDecimal.valueOf(15);
    private static final BigDecimal MIN_TOTAL_EQUITY_WEIGHT = BigDecimal.valueOf(85);
    private static final BigDecimal MAX_TOTAL_EQUITY_WEIGHT = BigDecimal.valueOf(95);
    private static final BigDecimal FIVE_PERCENT = BigDecimal.valueOf(5);
    private static final BigDecimal MAX_ABOVE_FIVE_TOTAL = BigDecimal.valueOf(40);

    public void validate(List<StressPortfolioPosition> positions) {
        if (positions == null || positions.size() != SUPPORTED_ASSETS.size()) {
            throw new BaseException(
                    ErrorCode.STRESS_RL_PORTFOLIO_INVALID
            );
        }

        Set<String> assetCodes = positions.stream()
                .map(StressPortfolioPosition::assetCode)
                .collect(Collectors.toSet());

        if (!assetCodes.equals(SUPPORTED_ASSETS)) {
            throw new BaseException(
                    ErrorCode.STRESS_RL_PORTFOLIO_INVALID
            );
        }

        validateTotalWeight(positions);
        validateTppWeight(positions);
        validateEquityWeights(positions);
    }

    private void validateTotalWeight(List<StressPortfolioPosition> positions) {
        BigDecimal totalWeight = positions.stream()
                .map(StressPortfolioPosition::weight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalWeight.compareTo(TOTAL_WEIGHT) != 0) {
            throw new BaseException(
                    ErrorCode.STRESS_RL_PORTFOLIO_INVALID
            );
        }
    }

    private void validateTppWeight(List<StressPortfolioPosition> positions) {
        BigDecimal tppWeight = positions.stream()
                .filter(position -> CASH_TPP.equals(position.assetCode()))
                .map(StressPortfolioPosition::weight)
                .findFirst()
                .orElseThrow(() ->
                        new BaseException(
                                ErrorCode.STRESS_RL_PORTFOLIO_INVALID
                        )
                );

        if (tppWeight.compareTo(MIN_TPP_WEIGHT) < 0
                || tppWeight.compareTo(MAX_TPP_WEIGHT) > 0) {
            throw new BaseException(
                    ErrorCode.STRESS_RL_PORTFOLIO_INVALID
            );
        }
    }

    private void validateEquityWeights(List<StressPortfolioPosition> positions) {
        List<StressPortfolioPosition> equities = positions.stream()
                .filter(position -> !CASH_TPP.equals(position.assetCode()))
                .toList();

        boolean invalidEquityWeight = equities.stream()
                .anyMatch(position ->
                        position.weight().compareTo(MIN_EQUITY_WEIGHT) < 0
                                || position.weight().compareTo(MAX_EQUITY_WEIGHT) > 0
                );

        if (invalidEquityWeight) {
            throw new BaseException(
                    ErrorCode.STRESS_RL_PORTFOLIO_INVALID
            );
        }

        BigDecimal totalEquityWeight = equities.stream()
                .map(StressPortfolioPosition::weight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (totalEquityWeight.compareTo(MIN_TOTAL_EQUITY_WEIGHT) < 0
                || totalEquityWeight.compareTo(MAX_TOTAL_EQUITY_WEIGHT) > 0) {
            throw new BaseException(
                    ErrorCode.STRESS_RL_PORTFOLIO_INVALID
            );
        }

        BigDecimal aboveFiveTotal = equities.stream()
                .filter(position ->
                        position.weight().compareTo(FIVE_PERCENT) > 0
                )
                .map(StressPortfolioPosition::weight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (aboveFiveTotal.compareTo(MAX_ABOVE_FIVE_TOTAL) > 0) {
            throw new BaseException(
                    ErrorCode.STRESS_RL_PORTFOLIO_INVALID
            );
        }
    }
}