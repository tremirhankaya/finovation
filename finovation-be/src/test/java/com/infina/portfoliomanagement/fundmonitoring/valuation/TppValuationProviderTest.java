package com.infina.portfoliomanagement.fundmonitoring.valuation;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.TppRate;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TppValuationProviderTest {

    @Test
    void annualWeightedRate_isConvertedToAccruedUnitValues() {
        LocalDate firstDate = LocalDate.of(2026, 1, 2);
        LocalDate secondDate = firstDate.plusDays(1);
        Asset asset = Asset.builder()
                .id(3L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .build();
        TppValuationProvider provider = new TppValuationProvider(null);

        var values = provider.toUnitValues(List.of(
                rate(asset, firstDate, "36.5"),
                rate(asset, secondDate, "36.5")
        )).get(asset.getId());

        assertThat(provider.supportedType()).isEqualTo(AssetType.TPP);
        assertThat(values.get(firstDate)).isEqualByComparingTo("1");
        assertThat(values.get(secondDate)).isEqualByComparingTo("1.001");
    }

    @Test
    void unitValueForTheSameDate_isIndependentOfRequestedStartDate() {
        LocalDate firstDate = LocalDate.of(2025, 5, 28);
        LocalDate secondDate = firstDate.plusDays(1);
        LocalDate thirdDate = secondDate.plusDays(1);
        Asset asset = Asset.builder()
                .id(3L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .build();
        List<TppRate> rates = List.of(
                rate(asset, firstDate, "36.5"),
                rate(asset, secondDate, "36.5"),
                rate(asset, thirdDate, "36.5")
        );
        TppValuationProvider provider = new TppValuationProvider(null);
        var allValues = provider.toUnitValues(rates);

        var fullRange = provider.valuesFrom(allValues, firstDate).get(asset.getId());
        var oneDayRange = provider.valuesFrom(allValues, thirdDate).get(asset.getId());

        assertThat(fullRange.get(thirdDate)).isEqualByComparingTo("1.002001");
        assertThat(oneDayRange)
                .containsOnlyKeys(thirdDate)
                .containsEntry(thirdDate, fullRange.get(thirdDate));
    }

    private TppRate rate(Asset asset, LocalDate date, String weightedAverageRate) {
        return TppRate.builder()
                .asset(asset)
                .dataDate(date)
                .weightedAverageRate(new BigDecimal(weightedAverageRate))
                .build();
    }
}
