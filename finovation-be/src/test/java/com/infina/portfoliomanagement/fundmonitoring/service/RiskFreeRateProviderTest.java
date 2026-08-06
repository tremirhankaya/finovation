package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.TppRate;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.TppRateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Month;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RiskFreeRateProviderTest {

    private static final LocalDate AS_OF_DATE = LocalDate.of(
            2026,
            Month.AUGUST,
            5
    );

    @Mock
    private AssetRepository assetRepository;
    @Mock
    private TppRateRepository tppRateRepository;

    private RiskFreeRateProvider provider;

    @BeforeEach
    void setUp() {
        provider = new RiskFreeRateProvider(assetRepository, tppRateRepository);
    }

    @Test
    void annualRate_returnsLatestTppRateOnOrBeforeSnapshotDate() {
        Asset asset = Asset.builder().id(3L).assetCode("TPP1G").build();
        TppRate rate = TppRate.builder()
                .asset(asset)
                .dataDate(AS_OF_DATE.minusDays(1))
                .weightedAverageRate(new BigDecimal("36.5000"))
                .build();
        when(assetRepository.findByAssetCode("TPP1G"))
                .thenReturn(Optional.of(asset));
        when(tppRateRepository
                .findTopByAssetIdAndDataDateLessThanEqualOrderByDataDateDesc(
                        3L,
                        AS_OF_DATE
                ))
                .thenReturn(Optional.of(rate));

        assertThat(provider.annualRate(AS_OF_DATE))
                .isEqualByComparingTo("36.5000");
    }
}
