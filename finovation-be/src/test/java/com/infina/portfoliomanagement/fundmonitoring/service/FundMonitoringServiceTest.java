package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.fund.repository.FundPositionRepository;
import com.infina.portfoliomanagement.fundmonitoring.classification.AssetClassificationProviderRegistry;
import com.infina.portfoliomanagement.fundmonitoring.config.FundMonitoringProperties;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundComparisonAssetResponse;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationPoint;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationResult;
import com.infina.portfoliomanagement.fundmonitoring.service.FundBenchmarkService.BenchmarkSnapshot;
import com.infina.portfoliomanagement.fundmonitoring.policy.FundMonitoringAccessPolicy;
import com.infina.portfoliomanagement.fundmonitoring.valuation.AssetValuationProviderRegistry;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Month;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FundMonitoringServiceTest {

    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-08-05T10:00:00Z"),
            ZoneOffset.UTC
    );
    private static final LocalDate AS_OF_DATE = LocalDate.of(2026, Month.AUGUST, 5);

    @Mock
    private FundDraftRepository fundDraftRepository;
    @Mock
    private FundPortfolioRepository fundPortfolioRepository;
    @Mock
    private FundPositionRepository fundPositionRepository;
    @Mock
    private AssetRepository assetRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private FundMonitoringAccessPolicy accessPolicy;
    @Mock
    private AssetValuationProviderRegistry valuationProviderRegistry;
    @Mock
    private AssetClassificationProviderRegistry classificationProviderRegistry;
    @Mock
    private FundValuationCalculator valuationCalculator;
    @Mock
    private FundBenchmarkService benchmarkService;
    @Mock
    private RiskFreeRateProvider riskFreeRateProvider;

    private FundMonitoringService service;

    @BeforeEach
    void setUp() {
        service = new FundMonitoringService(
                fundDraftRepository,
                fundPortfolioRepository,
                fundPositionRepository,
                assetRepository,
                userRepository,
                accessPolicy,
                valuationProviderRegistry,
                classificationProviderRegistry,
                valuationCalculator,
                new FundMetricCalculator(),
                benchmarkService,
                riskFreeRateProvider,
                new FundMonitoringProperties(new BigDecimal("1000000")),
                CLOCK
        );
    }

    @Test
    void monitoringSnapshot_includesSelectedAndOtherVisibleFundReturns() {
        FundDraft selectedFund = fund(1L, "Atlas Fonu");
        FundDraft otherFund = fund(2L, "Nova Fonu");
        User actor = mock(User.class);
        FundPortfolio portfolio = mock(FundPortfolio.class);

        when(actor.getId()).thenReturn(7L);
        when(userRepository.findByUsername("manager")).thenReturn(Optional.of(actor));
        when(fundDraftRepository.findByPublicIdAndStatus(
                selectedFund.getPublicId(),
                FundDraftStatus.COMPLETED
        )).thenReturn(Optional.of(selectedFund));
        when(fundDraftRepository
                .findAllByStatusAndCreatedByUserIdOrderByCreatedAtDescIdDesc(
                        FundDraftStatus.COMPLETED,
                        7L
                )).thenReturn(List.of(selectedFund, otherFund));
        when(fundPortfolioRepository.findByFundDraftIdAndSelectedTrue(anyLong()))
                .thenReturn(Optional.of(portfolio));
        when(portfolio.getId()).thenReturn(10L);
        when(fundPositionRepository
                .findAllByFundPortfolioIdOrderByWeightDesc(10L))
                .thenReturn(List.of());
        when(assetRepository.findAllById(List.of())).thenReturn(List.of());
        when(valuationProviderRegistry.loadUnitValues(
                eq(List.of()),
                any(LocalDate.class),
                eq(AS_OF_DATE)
        )).thenReturn(Map.of());
        when(classificationProviderRegistry.loadProfiles(List.of()))
                .thenReturn(Map.of());
        when(valuationCalculator.calculate(
                selectedFund,
                List.of(),
                List.of(),
                Map.of()
        )).thenReturn(valuation("100", "110"));
        when(valuationCalculator.calculate(
                otherFund,
                List.of(),
                List.of(),
                Map.of()
        )).thenReturn(valuation("100", "120"));
        when(benchmarkService.load(AS_OF_DATE)).thenReturn(
                new BenchmarkSnapshot(List.of(), new TreeMap<>())
        );

        var response = service.getMonitoringSnapshot(
                "manager",
                selectedFund.getPublicId()
        );

        assertThat(response.comparisonAssets())
                .extracting(
                        FundComparisonAssetResponse::name,
                        item -> item.returns().get("1M"),
                        FundComparisonAssetResponse::isFund,
                        item -> item.returns().size()
                )
                .containsExactly(
                        tuple("Atlas Fonu", new BigDecimal("10.0000"), true, 8),
                        tuple("Nova Fonu", new BigDecimal("20.0000"), true, 8)
                );
    }

    private FundDraft fund(Long id, String name) {
        return FundDraft.builder()
                .id(id)
                .publicId(UUID.randomUUID())
                .version(0)
                .name(name)
                .fundType(FundType.EQUITY_INTENSIVE)
                .currencyCode("TRY")
                .initialPortfolioSize(new BigDecimal("10000000"))
                .status(FundDraftStatus.COMPLETED)
                .createdByUserId(7L)
                .createdAt(LocalDateTime.of(2025, Month.JANUARY, 1, 10, 0))
                .updatedAt(LocalDateTime.of(2025, Month.JANUARY, 1, 10, 0))
                .build();
    }

    private FundValuationResult valuation(String start, String end) {
        return new FundValuationResult(
                List.of(
                        point(AS_OF_DATE.minusMonths(1), start),
                        point(AS_OF_DATE, end)
                ),
                List.of()
        );
    }

    private FundValuationPoint point(LocalDate date, String value) {
        BigDecimal price = new BigDecimal(value);
        return new FundValuationPoint(date, price, price);
    }
}
