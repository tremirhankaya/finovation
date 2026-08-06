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

    private TppRate rate(Asset asset, LocalDate date, String weightedAverageRate) {
        return TppRate.builder()
                .asset(asset)
                .dataDate(date)
                .weightedAverageRate(new BigDecimal(weightedAverageRate))
                .build();
    }
}
