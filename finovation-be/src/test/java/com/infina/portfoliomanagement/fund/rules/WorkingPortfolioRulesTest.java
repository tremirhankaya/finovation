package com.infina.portfoliomanagement.fund.rules;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.fund.dto.analysis.FundPositionResponse;
import com.infina.portfoliomanagement.fund.enums.ConstraintCode;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WorkingPortfolioRulesTest {

    private static final PortfolioRuleLimits LIMITS = new PortfolioRuleLimits(
            new BigDecimal("80"),
            new BigDecimal("95"),
            new BigDecimal("5"),
            new BigDecimal("15"),
            new BigDecimal("10"),
            new BigDecimal("30"),
            new BigDecimal("5"),
            new BigDecimal("40"),
            new BigDecimal("0.05"),
            10,
            30
    );

    @Test
    void compliantPortfolio_hasNoViolations() {
        assertThat(WorkingPortfolioRules.validate(compliantPortfolio(), LIMITS)).isEmpty();
    }

    @Test
    void weightsNotSummingToHundred_reportsTotalWeight() {
        List<FundPositionResponse> positions = new ArrayList<>(compliantPortfolio());
        positions.removeLast();

        assertThat(WorkingPortfolioRules.validate(positions, LIMITS))
                .extracting(RuleViolation::code)
                .contains(ConstraintCode.TOTAL_WEIGHT);
    }

    @Test
    void singleStockAboveLimit_reportsSingleStockMax() {
        List<FundPositionResponse> positions = List.of(
                equity("AEFES.E", "12", "GIDA"),
                equity("BRSAN.E", "78", "METAL"),
                tpp("10")
        );

        assertThat(WorkingPortfolioRules.validate(positions, LIMITS))
                .extracting(RuleViolation::code)
                .contains(ConstraintCode.SINGLE_STOCK_MAX);
    }

    @Test
    void sectorConcentrationAboveLimit_reportsSectorMax() {
        List<FundPositionResponse> positions = new ArrayList<>();
        for (int i = 0; i < 9; i++) {
            positions.add(equity("BANK" + i + ".E", "10", "BANKACILIK"));
        }
        positions.add(tpp("10"));

        assertThat(WorkingPortfolioRules.validate(positions, LIMITS))
                .extracting(RuleViolation::code)
                .contains(ConstraintCode.SECTOR_MAX);
    }

    @Test
    void tooFewStocks_reportsMinStockCount() {
        List<FundPositionResponse> positions = List.of(
                equity("AEFES.E", "45", "GIDA"),
                equity("BRSAN.E", "45", "METAL"),
                tpp("10")
        );

        assertThat(WorkingPortfolioRules.validate(positions, LIMITS))
                .extracting(RuleViolation::code)
                .contains(ConstraintCode.MIN_STOCK_COUNT);
    }

    @Test
    void equityBelowMinimum_reportsEquityMin() {
        List<FundPositionResponse> positions = new ArrayList<>();
        for (int i = 0; i < 15; i++) {
            positions.add(equity("STOCK" + i + ".E", "5", "SEKTOR" + i));
        }
        positions.add(tpp("25"));

        assertThat(WorkingPortfolioRules.validate(positions, LIMITS))
                .extracting(RuleViolation::code)
                .contains(ConstraintCode.EQUITY_MIN);
    }

    @Test
    void equityAboveMaximum_reportsEquityMax() {
        List<FundPositionResponse> positions = new ArrayList<>();
        for (int i = 0; i < 24; i++) {
            positions.add(equity("STOCK" + i + ".E", "4", "SEKTOR" + i));
        }
        positions.add(tpp("4"));

        assertThat(WorkingPortfolioRules.validate(positions, LIMITS))
                .extracting(RuleViolation::code)
                .contains(ConstraintCode.EQUITY_MAX);
    }

    @Test
    void tppOutsideRange_reportsTppWeight() {
        List<FundPositionResponse> positions = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            positions.add(equity("STOCK" + i + ".E", "8", "SEKTOR" + i));
        }
        positions.add(tpp("4"));

        assertThat(WorkingPortfolioRules.validate(positions, LIMITS))
                .extracting(RuleViolation::code)
                .contains(ConstraintCode.TPP_MIN);
    }

    @Test
    void tppAtExactBoundary_isAccepted() {
        List<FundPositionResponse> positions = new ArrayList<>();
        for (int i = 0; i < 19; i++) {
            positions.add(equity("STOCK" + i + ".E", "5", "SEKTOR" + i));
        }
        positions.add(tpp("5"));

        assertThat(WorkingPortfolioRules.validate(positions, LIMITS)).isEmpty();
    }

    private static List<FundPositionResponse> compliantPortfolio() {
        List<FundPositionResponse> positions = new ArrayList<>();
        for (int i = 0; i < 18; i++) {
            positions.add(equity("STOCK" + i + ".E", "5", "SEKTOR" + i));
        }
        positions.add(tpp("10"));
        return positions;
    }

    private static FundPositionResponse equity(String code, String weight, String sector) {
        return new FundPositionResponse(
                code,
                new BigDecimal(weight),
                null,
                sector,
                AssetType.EQUITY
        );
    }

    private static FundPositionResponse tpp(String weight) {
        return new FundPositionResponse(
                "TPP",
                new BigDecimal(weight),
                null,
                null,
                AssetType.TPP
        );
    }
}
