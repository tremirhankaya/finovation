package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fundmonitoring.config.FundMonitoringProperties;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FundValuationCalculatorTest {

    private static final LocalDate INCEPTION_DATE = LocalDate.of(2026, 1, 2);

    private FundValuationCalculator calculator;
    private Asset firstAsset;
    private Asset secondAsset;
    private FundDraft fund;

    @BeforeEach
    void setUp() {
        calculator = new FundValuationCalculator(
                new FundMonitoringProperties(
                        new BigDecimal("100"),
                        new BigDecimal("37")
                )
        );
        firstAsset = asset(1L, "AAA.E");
        secondAsset = asset(2L, "BBB.E");
        fund = FundDraft.builder()
                .id(10L)
                .initialPortfolioSize(new BigDecimal("1000"))
                .createdAt(INCEPTION_DATE.atStartOfDay())
                .build();
    }

    @Test
    void inceptionWeights_areConvertedToBuyAndHoldQuantitiesAndHistoricallyValued() {
        List<FundPosition> positions = List.of(
                position(firstAsset.getId(), "50"),
                position(secondAsset.getId(), "50")
        );
        Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValues = Map.of(
                firstAsset.getId(), values("10", "11"),
                secondAsset.getId(), values("20", "20")
        );

        var result = calculator.calculate(
                fund,
                positions,
                List.of(firstAsset, secondAsset),
                unitValues
        );

        assertThat(result.points()).hasSize(2);
        assertThat(result.points().getFirst().nav()).isEqualByComparingTo("1000");
        assertThat(result.points().getFirst().sharePrice()).isEqualByComparingTo("10");
        assertThat(result.latestPoint().nav()).isEqualByComparingTo("1050");
        assertThat(result.latestPoint().sharePrice()).isEqualByComparingTo("10.5");
        assertThat(result.positions().getFirst().currentWeightPercentage())
                .isEqualByComparingTo("52.380952");
    }

    @Test
    void datesWithoutAllAssetPrices_areExcludedFromFundSeries() {
        List<FundPosition> positions = List.of(
                position(firstAsset.getId(), "50"),
                position(secondAsset.getId(), "50")
        );
        Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValues = Map.of(
                firstAsset.getId(), values("10", "11"),
                secondAsset.getId(), values("20")
        );

        var result = calculator.calculate(
                fund,
                positions,
                List.of(firstAsset, secondAsset),
                unitValues
        );

        assertThat(result.points()).singleElement()
                .extracting(point -> point.date())
                .isEqualTo(INCEPTION_DATE);
    }

    @Test
    void weightsNotSummingToOneHundred_areRejectedWithStableErrorCode() {
        List<FundPosition> positions = List.of(
                position(firstAsset.getId(), "40"),
                position(secondAsset.getId(), "50")
        );

        assertThatThrownBy(() -> calculator.calculate(
                fund,
                positions,
                List.of(firstAsset, secondAsset),
                Map.of()
        ))
                .isInstanceOf(BaseException.class)
                .extracting(error -> ((BaseException) error).getErrorCode())
                .isEqualTo(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
    }

    @Test
    void normalizedUnitValues_areValuedWithoutKnowingTheAssetMarketDataType() {
        Asset tppAsset = Asset.builder()
                .id(3L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .build();
        List<FundPosition> positions = List.of(
                position(firstAsset.getId(), "90"),
                position(tppAsset.getId(), "10")
        );
        Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValues = Map.of(
                firstAsset.getId(), values("10", "10"),
                tppAsset.getId(), values("1", "1.001")
        );

        var result = calculator.calculate(
                fund,
                positions,
                List.of(firstAsset, tppAsset),
                unitValues
        );

        assertThat(result.latestPoint().nav()).isEqualByComparingTo("1000.1");
        assertThat(result.latestPoint().sharePrice()).isEqualByComparingTo("10.001");
        assertThat(result.positions().stream()
                .filter(position -> position.asset().getAssetType() == AssetType.TPP)
                .findFirst().orElseThrow().currentWeightPercentage())
                .isEqualByComparingTo("10.008999");
    }

    private Asset asset(Long id, String code) {
        return Asset.builder()
                .id(id)
                .assetCode(code)
                .assetType(AssetType.EQUITY)
                .build();
    }

    private FundPosition position(Long assetId, String weight) {
        return FundPosition.builder()
                .assetId(assetId)
                .weight(new BigDecimal(weight))
                .build();
    }

    private NavigableMap<LocalDate, BigDecimal> values(String... values) {
        NavigableMap<LocalDate, BigDecimal> series = new TreeMap<>();
        for (int index = 0; index < values.length; index++) {
            series.put(INCEPTION_DATE.plusDays(index), new BigDecimal(values[index]));
        }
        return series;
    }
}
