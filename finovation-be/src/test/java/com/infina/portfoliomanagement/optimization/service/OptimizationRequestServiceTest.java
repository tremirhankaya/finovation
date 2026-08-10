package com.infina.portfoliomanagement.optimization.service;

import com.infina.portfoliomanagement.common.time.FinancialTimeProperties;
import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.fund.repository.FundPositionRepository;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundPositionResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundSummaryResponse;
import com.infina.portfoliomanagement.fundmonitoring.service.FundMonitoringService;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import com.infina.portfoliomanagement.marketdata.entity.Sector;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import com.infina.portfoliomanagement.optimization.dto.ApproveOptimizationRequestRequest;
import com.infina.portfoliomanagement.optimization.dto.ApproveOptimizationRequestRequest.AssetWeightOverride;
import com.infina.portfoliomanagement.optimization.dto.OptimizationLogEntryResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationRequestResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultAssetResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizableFundResponse;
import com.infina.portfoliomanagement.optimization.engine.EngineAlternative;
import com.infina.portfoliomanagement.optimization.engine.OptimizationEngineClient;
import com.infina.portfoliomanagement.optimization.engine.OptimizationEngineResult;
import com.infina.portfoliomanagement.optimization.entity.OptimizationRequest;
import com.infina.portfoliomanagement.optimization.entity.OptimizationResult;
import com.infina.portfoliomanagement.optimization.entity.OptimizationResultAsset;
import com.infina.portfoliomanagement.optimization.entity.OptimizationResultMetric;
import com.infina.portfoliomanagement.optimization.entity.RequestConstraintTarget;
import com.infina.portfoliomanagement.optimization.enums.OptimizationConstraintCode;
import com.infina.portfoliomanagement.optimization.enums.RequestStatus;
import com.infina.portfoliomanagement.optimization.enums.ResultActionType;
import com.infina.portfoliomanagement.optimization.enums.RiskProfile;
import com.infina.portfoliomanagement.optimization.policy.OptimizationRequestPolicy;
import com.infina.portfoliomanagement.optimization.repository.AssetPreferenceRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationRequestRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationResultAssetRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationResultMetricRepository;
import com.infina.portfoliomanagement.optimization.repository.OptimizationResultRepository;
import com.infina.portfoliomanagement.optimization.repository.RequestConstraintTargetRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.enums.Role;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OptimizationRequestServiceTest {

    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-08-08T10:00:00Z"),
            ZoneOffset.UTC
    );
    private static final UUID FUND_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final String ACTOR_USERNAME = "fon-yoneticisi";
    private static final Long REQUEST_ID = 42L;

    @Mock
    private OptimizationRequestRepository optimizationRequestRepository;
    @Mock
    private RequestConstraintTargetRepository requestConstraintTargetRepository;
    @Mock
    private AssetPreferenceRepository assetPreferenceRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private OptimizationRequestPolicy optimizationRequestPolicy;
    @Mock
    private OptimizationEngineClient optimizationEngineClient;
    @Mock
    private FundMonitoringService fundMonitoringService;
    @Mock
    private AssetRepository assetRepository;
    @Mock
    private EquityDetailRepository equityDetailRepository;
    @Mock
    private OptimizationResultRepository optimizationResultRepository;
    @Mock
    private OptimizationResultAssetRepository optimizationResultAssetRepository;
    @Mock
    private OptimizationResultMetricRepository optimizationResultMetricRepository;
    @Mock
    private FundDraftRepository fundDraftRepository;
    @Mock
    private FundPortfolioRepository fundPortfolioRepository;
    @Mock
    private FundPositionRepository fundPositionRepository;

    private OptimizationRequestService service;

    @BeforeEach
    void setUp() {
        service = new OptimizationRequestService(
                optimizationRequestRepository,
                requestConstraintTargetRepository,
                assetPreferenceRepository,
                userRepository,
                optimizationRequestPolicy,
                optimizationEngineClient,
                fundMonitoringService,
                assetRepository,
                equityDetailRepository,
                optimizationResultRepository,
                optimizationResultAssetRepository,
                optimizationResultMetricRepository,
                fundDraftRepository,
                fundPortfolioRepository,
                fundPositionRepository,
                new FinancialTimeProvider(
                        CLOCK,
                        new FinancialTimeProperties(false, null, null, ZoneOffset.UTC)
                )
        );
    }

    @Test
    void listOptimizableFunds_buildsSummaryFromWorkingPortfolio() {
        User actor = User.builder()
                .id(7L)
                .username(ACTOR_USERNAME)
                .build();
        FundDraft fund = FundDraft.builder()
                .id(10L)
                .publicId(FUND_ID)
                .name("Güncel Fon")
                .fundType(FundType.EQUITY_INTENSIVE)
                .build();
        FundPortfolio working = FundPortfolio.builder()
                .id(20L)
                .portfolioType(PortfolioType.WORKING)
                .build();
        FundPosition tppPosition = FundPosition.builder()
                .fundPortfolio(working)
                .assetId(101L)
                .weight(new BigDecimal("10"))
                .build();
        Asset tppAsset = Asset.builder()
                .id(101L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(fundDraftRepository.findAllByStatusAndCreatedByUserIdOrderByCreatedAtDescIdDesc(
                FundDraftStatus.COMPLETED,
                actor.getId()
        )).thenReturn(List.of(fund));
        when(fundPortfolioRepository.findByFundDraft_IdAndPortfolioType(
                fund.getId(),
                PortfolioType.WORKING
        )).thenReturn(Optional.of(working));
        when(fundPositionRepository.findAllByFundPortfolioIdOrderByWeightDesc(working.getId()))
                .thenReturn(List.of(tppPosition));
        when(assetRepository.findAllById(List.of(101L))).thenReturn(List.of(tppAsset));

        List<OptimizableFundResponse> response = service.listOptimizableFunds(ACTOR_USERNAME);

        assertThat(response).singleElement().satisfies(summary -> {
            assertThat(summary.id()).isEqualTo(FUND_ID);
            assertThat(summary.tppWeightPercent()).isEqualByComparingTo("10");
        });
        verify(fundPortfolioRepository).findByFundDraft_IdAndPortfolioType(
                fund.getId(),
                PortfolioType.WORKING
        );
    }

    @Test
    void run_withSuccessfulEngineResponse_persistsBalancedUtilityAlternativeAssets() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.PREPARING)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(optimizationRequestRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        when(requestConstraintTargetRepository.findAllByRequestId(REQUEST_ID)).thenReturn(List.of(
                constraintTarget(OptimizationConstraintCode.STOCK_COUNT_MIN, BigDecimal.valueOf(16), null),
                constraintTarget(OptimizationConstraintCode.STOCK_COUNT_MAX, null, BigDecimal.valueOf(30)),
                constraintTarget(OptimizationConstraintCode.TPP_MIN, BigDecimal.valueOf(5), null),
                constraintTarget(OptimizationConstraintCode.TPP_MAX, null, BigDecimal.valueOf(15))
        ));
        when(assetPreferenceRepository.findAllByRequestId(REQUEST_ID)).thenReturn(List.of());

        when(fundMonitoringService.getMonitoringSnapshot(ACTOR_USERNAME, FUND_ID))
                .thenReturn(fundMonitoringResponse());
        when(fundMonitoringService.getCurrentPositions(ACTOR_USERNAME, FUND_ID))
                .thenReturn(fundMonitoringResponse().positions());

        Asset tppAsset = Asset.builder()
                .id(99L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .active(true)
                .build();
        when(assetRepository.findAllByAssetTypeAndActiveTrueOrderByAssetCodeAsc(AssetType.TPP))
                .thenReturn(List.of(tppAsset));

        when(optimizationEngineClient.run(any())).thenReturn(engineResult());

        when(optimizationResultRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            OptimizationResult result = invocation.getArgument(0);
            result.setId(555L);
            return result;
        });

        service.run(ACTOR_USERNAME, REQUEST_ID);

        assertThat(request.getStatus()).isEqualTo(RequestStatus.COMPLETED);
        assertThat(request.getModelVersion()).isEqualTo("FROZEN_2025-05-29_V3");
        assertThat(request.getDataTimestamp()).isEqualTo(LocalDate.of(2025, 5, 29).atStartOfDay());

        ArgumentCaptor<List<OptimizationResultAsset>> captor = ArgumentCaptor.forClass(List.class);
        verify(optimizationResultAssetRepository).saveAll(captor.capture());

        List<OptimizationResultAsset> savedAssets = captor.getValue();
        assertThat(savedAssets).hasSize(2);

        OptimizationResultAsset akbnk = savedAssets.stream()
                .filter(asset -> asset.getAssetCode().equals("AKBNK.E"))
                .findFirst()
                .orElseThrow();
        assertThat(akbnk.getAssetType()).isEqualTo(AssetType.EQUITY);
        assertThat(akbnk.getCurrentWeight()).isEqualByComparingTo("0.5");
        assertThat(akbnk.getProposedWeight()).isEqualByComparingTo("0.45");
        assertThat(akbnk.getChangeAmount()).isEqualByComparingTo("-0.05");
        assertThat(akbnk.getActionType()).isEqualTo(ResultActionType.DECREASE);
        assertThat(akbnk.getRationale()).isEqualTo("Ağırlık mevcut portföye göre azaltıldı.");
        assertThat(akbnk.isManuallyOverridden()).isFalse();

        OptimizationResultAsset tpp = savedAssets.stream()
                .filter(asset -> asset.getAssetCode().equals("TPP1G"))
                .findFirst()
                .orElseThrow();
        assertThat(tpp.getAssetType()).isEqualTo(AssetType.TPP);
        assertThat(tpp.getCurrentWeight()).isEqualByComparingTo("0.5");
        assertThat(tpp.getProposedWeight()).isEqualByComparingTo("0.55");
        assertThat(tpp.getChangeAmount()).isEqualByComparingTo("0.05");
        assertThat(tpp.getActionType()).isEqualTo(ResultActionType.INCREASE);
    }

    @Test
    void run_withUnparseableEngineSystemDate_stillCompletesWithoutDataTimestamp() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.PREPARING)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(optimizationRequestRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        when(requestConstraintTargetRepository.findAllByRequestId(REQUEST_ID)).thenReturn(List.of(
                constraintTarget(OptimizationConstraintCode.STOCK_COUNT_MIN, BigDecimal.valueOf(16), null),
                constraintTarget(OptimizationConstraintCode.STOCK_COUNT_MAX, null, BigDecimal.valueOf(30)),
                constraintTarget(OptimizationConstraintCode.TPP_MIN, BigDecimal.valueOf(5), null),
                constraintTarget(OptimizationConstraintCode.TPP_MAX, null, BigDecimal.valueOf(15))
        ));
        when(assetPreferenceRepository.findAllByRequestId(REQUEST_ID)).thenReturn(List.of());

        when(fundMonitoringService.getMonitoringSnapshot(ACTOR_USERNAME, FUND_ID))
                .thenReturn(fundMonitoringResponse());
        when(fundMonitoringService.getCurrentPositions(ACTOR_USERNAME, FUND_ID))
                .thenReturn(fundMonitoringResponse().positions());

        Asset tppAsset = Asset.builder()
                .id(99L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .active(true)
                .build();
        when(assetRepository.findAllByAssetTypeAndActiveTrueOrderByAssetCodeAsc(AssetType.TPP))
                .thenReturn(List.of(tppAsset));

        when(optimizationEngineClient.run(any())).thenReturn(engineResult("not-a-real-date"));

        when(optimizationResultRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            OptimizationResult result = invocation.getArgument(0);
            result.setId(555L);
            return result;
        });

        service.run(ACTOR_USERNAME, REQUEST_ID);

        assertThat(request.getStatus()).isEqualTo(RequestStatus.COMPLETED);
        assertThat(request.getDataTimestamp()).isNull();
    }

    @Test
    void run_computesAndPersistsInfoMetricsForCurrentAndProposedPortfolio() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.PREPARING)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(optimizationRequestRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        when(requestConstraintTargetRepository.findAllByRequestId(REQUEST_ID)).thenReturn(List.of(
                constraintTarget(OptimizationConstraintCode.STOCK_COUNT_MIN, BigDecimal.valueOf(16), null),
                constraintTarget(OptimizationConstraintCode.STOCK_COUNT_MAX, null, BigDecimal.valueOf(30)),
                constraintTarget(OptimizationConstraintCode.TPP_MIN, BigDecimal.valueOf(5), null),
                constraintTarget(OptimizationConstraintCode.TPP_MAX, null, BigDecimal.valueOf(15))
        ));
        when(assetPreferenceRepository.findAllByRequestId(REQUEST_ID)).thenReturn(List.of());

        FundMonitoringResponse currentSnapshot = new FundMonitoringResponse(
                new FundSummaryResponse(FUND_ID, "Test Fonu", null, "TRY", LocalDate.of(2026, 1, 1)),
                LocalDate.of(2026, 8, 8),
                "TRY",
                BigDecimal.valueOf(1000000),
                BigDecimal.TEN,
                BigDecimal.ZERO,
                Map.of(),
                null,
                List.of(
                        new FundMonitoringResponse.TechnicalIndicatorResponse(
                                "BETA", "Beta", new BigDecimal("1.10"), "RATIO", "neutral", "d"
                        ),
                        new FundMonitoringResponse.TechnicalIndicatorResponse(
                                "SHARPE", "Sharpe", new BigDecimal("0.80"), "RATIO", "neutral", "d"
                        ),
                        new FundMonitoringResponse.TechnicalIndicatorResponse(
                                "CALMAR", "Calmar", new BigDecimal("0.50"), "RATIO", "neutral", "d"
                        )
                ),
                List.of(),
                List.of(
                        new FundPositionResponse("1", "AKBNK.E", "Akbank", "Bankalar", BigDecimal.valueOf(50)),
                        new FundPositionResponse("2", "TPP1G", "TPP", null, BigDecimal.valueOf(50))
                ),
                List.of(),
                List.of()
        );
        when(fundMonitoringService.getMonitoringSnapshot(ACTOR_USERNAME, FUND_ID))
                .thenReturn(currentSnapshot);
        when(fundMonitoringService.getCurrentPositions(ACTOR_USERNAME, FUND_ID))
                .thenReturn(currentSnapshot.positions());

        Asset tppAsset = Asset.builder()
                .id(99L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .active(true)
                .build();
        when(assetRepository.findAllByAssetTypeAndActiveTrueOrderByAssetCodeAsc(AssetType.TPP))
                .thenReturn(List.of(tppAsset));

        when(optimizationEngineClient.run(any())).thenReturn(engineResult());

        when(optimizationResultRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            OptimizationResult result = invocation.getArgument(0);
            result.setId(555L);
            return result;
        });

        when(fundMonitoringService.computeMetricsForWeights(eq(ACTOR_USERNAME), eq(FUND_ID), any()))
                .thenReturn(List.of(
                        new FundMonitoringResponse.TechnicalIndicatorResponse(
                                "BETA", "Beta", new BigDecimal("0.95"), "RATIO", "neutral", "d"
                        ),
                        new FundMonitoringResponse.TechnicalIndicatorResponse(
                                "SHARPE", "Sharpe", new BigDecimal("1.20"), "RATIO", "neutral", "d"
                        ),
                        new FundMonitoringResponse.TechnicalIndicatorResponse(
                                "CALMAR", "Calmar", new BigDecimal("0.60"), "RATIO", "neutral", "d"
                        )
                ));

        service.run(ACTOR_USERNAME, REQUEST_ID);

        ArgumentCaptor<Map<String, BigDecimal>> weightsCaptor = ArgumentCaptor.forClass(Map.class);
        verify(fundMonitoringService)
                .computeMetricsForWeights(eq(ACTOR_USERNAME), eq(FUND_ID), weightsCaptor.capture());
        assertThat(weightsCaptor.getValue()).containsKey("TPP1G");
        assertThat(weightsCaptor.getValue()).doesNotContainKey("CASH_TPP");

        ArgumentCaptor<List<OptimizationResultMetric>> metricsCaptor = ArgumentCaptor.forClass(List.class);
        verify(optimizationResultMetricRepository).saveAll(metricsCaptor.capture());

        List<OptimizationResultMetric> savedMetrics = metricsCaptor.getValue();
        assertThat(savedMetrics).hasSize(9);

        OptimizationResultMetric beta = savedMetrics.stream()
                .filter(metric -> metric.getMetricKey().equals("BETA"))
                .findFirst()
                .orElseThrow();
        assertThat(beta.getCurrentValue()).isEqualByComparingTo("1.10");
        assertThat(beta.getProposedValue()).isEqualByComparingTo("0.95");

        OptimizationResultMetric sharpe = savedMetrics.stream()
                .filter(metric -> metric.getMetricKey().equals("SHARPE_RATIO"))
                .findFirst()
                .orElseThrow();
        assertThat(sharpe.getCurrentValue()).isEqualByComparingTo("0.80");
        assertThat(sharpe.getProposedValue()).isEqualByComparingTo("1.20");

        OptimizationResultMetric calmar = savedMetrics.stream()
                .filter(metric -> metric.getMetricKey().equals("CALMAR_RATIO"))
                .findFirst()
                .orElseThrow();
        assertThat(calmar.getCurrentValue()).isEqualByComparingTo("0.50");
        assertThat(calmar.getProposedValue()).isEqualByComparingTo("0.60");

        OptimizationResultMetric alpha = savedMetrics.stream()
                .filter(metric -> metric.getMetricKey().equals("ALPHA"))
                .findFirst()
                .orElseThrow();
        assertThat(alpha.getCurrentValue()).isNull();
        assertThat(alpha.getProposedValue()).isNull();
    }

    @Test
    void approve_withPartialOverride_updatesFundPositionsAndStampsResultApproval() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .firstName("Sefa")
                .lastName("Ecir")
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.COMPLETED)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(optimizationRequestRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OptimizationResult result = OptimizationResult.builder()
                .id(555L)
                .request(request)
                .generatedAt(LocalDateTime.now(CLOCK))
                .createdAt(LocalDateTime.now(CLOCK))
                .build();
        when(optimizationResultRepository.findFirstByRequestIdOrderByIdDesc(REQUEST_ID))
                .thenReturn(Optional.of(result));

        OptimizationResultAsset akbnk = OptimizationResultAsset.builder()
                .id(1L)
                .assetCode("AKBNK.E")
                .assetType(AssetType.EQUITY)
                .currentWeight(new BigDecimal("0.50"))
                .proposedWeight(new BigDecimal("0.45"))
                .changeAmount(new BigDecimal("-0.05"))
                .actionType(ResultActionType.DECREASE)
                .manuallyOverridden(false)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();
        OptimizationResultAsset tpp = OptimizationResultAsset.builder()
                .id(2L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .currentWeight(new BigDecimal("0.50"))
                .proposedWeight(new BigDecimal("0.60"))
                .changeAmount(new BigDecimal("0.10"))
                .actionType(ResultActionType.INCREASE)
                .manuallyOverridden(false)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();
        when(optimizationResultAssetRepository.findAllByResultId(555L))
                .thenReturn(List.of(akbnk, tpp));

        FundDraft fundDraft = FundDraft.builder().id(10L).publicId(FUND_ID).build();
        when(fundDraftRepository.findByPublicIdAndStatus(FUND_ID, FundDraftStatus.COMPLETED))
                .thenReturn(Optional.of(fundDraft));

        FundPortfolio portfolio = FundPortfolio.builder()
                .id(20L)
                .portfolioType(PortfolioType.WORKING)
                .build();
        when(fundPortfolioRepository.findByFundDraft_IdAndPortfolioType(
                10L,
                PortfolioType.WORKING
        ))
                .thenReturn(Optional.of(portfolio));

        Asset akbnkAsset = Asset.builder().id(101L).assetCode("AKBNK.E").assetType(AssetType.EQUITY).build();
        Asset tppAsset = Asset.builder().id(102L).assetCode("TPP1G").assetType(AssetType.TPP).build();
        when(assetRepository.findByAssetCode("AKBNK.E")).thenReturn(Optional.of(akbnkAsset));
        when(assetRepository.findByAssetCode("TPP1G")).thenReturn(Optional.of(tppAsset));

        ApproveOptimizationRequestRequest overrideRequest = new ApproveOptimizationRequestRequest(
                List.of(new AssetWeightOverride("AKBNK.E", new BigDecimal("40")))
        );

        OptimizationRequestResponse response = service.approve(ACTOR_USERNAME, REQUEST_ID, overrideRequest);

        assertThat(response.status()).isEqualTo(RequestStatus.APPROVED);
        assertThat(request.getStatus()).isEqualTo(RequestStatus.APPROVED);
        assertThat(request.getDecidedBy()).isEqualTo(actor);
        assertThat(response.decidedByUserId()).isEqualTo(7L);
        assertThat(response.decidedByUsername()).isEqualTo(ACTOR_USERNAME);
        assertThat(response.decidedByDisplayName()).isEqualTo("Sefa Ecir");

        assertThat(akbnk.getFinalWeight()).isEqualByComparingTo("0.40");
        assertThat(akbnk.isManuallyOverridden()).isTrue();
        assertThat(tpp.getFinalWeight()).isEqualByComparingTo("0.60");
        assertThat(tpp.isManuallyOverridden()).isFalse();

        verify(fundPositionRepository).deleteAllByFundPortfolioId(20L);

        ArgumentCaptor<List<FundPosition>> positionsCaptor = ArgumentCaptor.forClass(List.class);
        verify(fundPositionRepository).saveAll(positionsCaptor.capture());
        List<FundPosition> savedPositions = positionsCaptor.getValue();
        assertThat(savedPositions).hasSize(2);

        FundPosition akbnkPosition = savedPositions.stream()
                .filter(position -> position.getAssetId().equals(101L))
                .findFirst()
                .orElseThrow();
        assertThat(akbnkPosition.getWeight()).isEqualByComparingTo("40.00");

        FundPosition tppPosition = savedPositions.stream()
                .filter(position -> position.getAssetId().equals(102L))
                .findFirst()
                .orElseThrow();
        assertThat(tppPosition.getWeight()).isEqualByComparingTo("60.00");

        assertThat(result.getApprovedByUserId()).isEqualTo(7L);
        assertThat(result.getApprovedAt()).isEqualTo(LocalDateTime.now(CLOCK));
        verify(optimizationResultRepository).save(result);
    }

    @Test
    void approve_withFinalWeightsNotSummingToOneHundred_throwsAndDoesNotTouchFund() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.COMPLETED)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));

        OptimizationResult result = OptimizationResult.builder()
                .id(555L)
                .request(request)
                .generatedAt(LocalDateTime.now(CLOCK))
                .createdAt(LocalDateTime.now(CLOCK))
                .build();
        when(optimizationResultRepository.findFirstByRequestIdOrderByIdDesc(REQUEST_ID))
                .thenReturn(Optional.of(result));

        OptimizationResultAsset akbnk = OptimizationResultAsset.builder()
                .id(1L)
                .assetCode("AKBNK.E")
                .assetType(AssetType.EQUITY)
                .currentWeight(new BigDecimal("0.50"))
                .proposedWeight(new BigDecimal("0.45"))
                .changeAmount(new BigDecimal("-0.05"))
                .actionType(ResultActionType.DECREASE)
                .manuallyOverridden(false)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();
        OptimizationResultAsset tpp = OptimizationResultAsset.builder()
                .id(2L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .currentWeight(new BigDecimal("0.50"))
                .proposedWeight(new BigDecimal("0.50"))
                .changeAmount(BigDecimal.ZERO)
                .actionType(ResultActionType.KEEP)
                .manuallyOverridden(false)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();
        when(optimizationResultAssetRepository.findAllByResultId(555L))
                .thenReturn(List.of(akbnk, tpp));

        assertThatThrownBy(() -> service.approve(ACTOR_USERNAME, REQUEST_ID, null))
                .isInstanceOf(BaseException.class)
                .extracting(error -> ((BaseException) error).getErrorCode())
                .isEqualTo(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);

        assertThat(request.getStatus()).isEqualTo(RequestStatus.COMPLETED);
        verifyNoInteractions(fundDraftRepository, fundPortfolioRepository, fundPositionRepository);
    }

    @Test
    void reject_stampsDecidedByWithActor() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .firstName("Sefa")
                .lastName("Ecir")
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.COMPLETED)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(optimizationRequestRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OptimizationRequestResponse response =
                service.reject(ACTOR_USERNAME, REQUEST_ID, "Sektör dağılımı hedeflere uymuyor");

        assertThat(response.status()).isEqualTo(RequestStatus.REJECTED);
        assertThat(request.getStatus()).isEqualTo(RequestStatus.REJECTED);
        assertThat(request.getDecidedBy()).isEqualTo(actor);
        assertThat(response.decidedByUserId()).isEqualTo(7L);
        assertThat(response.decidedByUsername()).isEqualTo(ACTOR_USERNAME);
        assertThat(response.decidedByDisplayName()).isEqualTo("Sefa Ecir");
        assertThat(response.requestedByUsername()).isEqualTo(ACTOR_USERNAME);
        assertThat(response.requestedByDisplayName()).isEqualTo("Sefa Ecir");
        assertThat(request.getRejectionReason()).isEqualTo("Sektör dağılımı hedeflere uymuyor");
        assertThat(response.rejectionReason()).isEqualTo("Sektör dağılımı hedeflere uymuyor");
    }

    @Test
    void reject_withActorMissingLastName_omitsNullFromDisplayName() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .firstName("Sefa")
                .lastName(null)
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.COMPLETED)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(optimizationRequestRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OptimizationRequestResponse response = service.reject(ACTOR_USERNAME, REQUEST_ID, null);

        assertThat(response.decidedByDisplayName()).isEqualTo("Sefa");
        assertThat(response.requestedByDisplayName()).isEqualTo("Sefa");
    }

    @Test
    void reject_withBlankReason_storesNullRejectionReason() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .firstName("Sefa")
                .lastName("Ecir")
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.COMPLETED)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(optimizationRequestRepository.saveAndFlush(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OptimizationRequestResponse response = service.reject(ACTOR_USERNAME, REQUEST_ID, "   ");

        assertThat(request.getRejectionReason()).isNull();
        assertThat(response.rejectionReason()).isNull();
    }

    @Test
    void getResult_returnsPercentageWeightsWithResolvedNameAndSector() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.COMPLETED)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));

        OptimizationResult result = OptimizationResult.builder()
                .id(555L)
                .request(request)
                .generatedAt(LocalDateTime.now(CLOCK))
                .createdAt(LocalDateTime.now(CLOCK))
                .build();
        when(optimizationResultRepository.findFirstByRequestIdOrderByIdDesc(REQUEST_ID))
                .thenReturn(Optional.of(result));

        OptimizationResultAsset akbnk = OptimizationResultAsset.builder()
                .id(1L)
                .assetCode("AKBNK.E")
                .assetType(AssetType.EQUITY)
                .currentWeight(new BigDecimal("0.50"))
                .proposedWeight(new BigDecimal("0.45"))
                .finalWeight(new BigDecimal("0.40"))
                .changeAmount(new BigDecimal("-0.05"))
                .actionType(ResultActionType.DECREASE)
                .manuallyOverridden(true)
                .rationale("Ağırlık mevcut portföye göre azaltıldı.")
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();
        OptimizationResultAsset tpp = OptimizationResultAsset.builder()
                .id(2L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .currentWeight(new BigDecimal("0.50"))
                .proposedWeight(new BigDecimal("0.60"))
                .changeAmount(new BigDecimal("0.10"))
                .actionType(ResultActionType.INCREASE)
                .manuallyOverridden(false)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();
        when(optimizationResultAssetRepository.findAllByResultId(555L))
                .thenReturn(List.of(akbnk, tpp));

        Asset akbnkAsset = Asset.builder()
                .id(101L)
                .assetCode("AKBNK.E")
                .assetType(AssetType.EQUITY)
                .displayName("Akbank T.A.Ş.")
                .build();
        Asset tppAsset = Asset.builder()
                .id(102L)
                .assetCode("TPP1G")
                .assetType(AssetType.TPP)
                .build();
        when(assetRepository.findAllByAssetCodeIn(List.of("AKBNK.E", "TPP1G")))
                .thenReturn(List.of(akbnkAsset, tppAsset));

        Sector bankingSector = Sector.builder().id(1L).sectorCode("S1").name("Bankacılık").build();
        EquityDetail akbnkDetail = EquityDetail.builder()
                .assetId(101L)
                .asset(akbnkAsset)
                .sector(bankingSector)
                .companyName("Akbank")
                .build();
        when(equityDetailRepository.findAllByAssetIdIn(List.of(101L, 102L)))
                .thenReturn(List.of(akbnkDetail));

        OptimizationResultMetric betaMetric = OptimizationResultMetric.builder()
                .id(1L)
                .metricKey("BETA")
                .currentValue(new BigDecimal("1.10"))
                .proposedValue(new BigDecimal("0.95"))
                .createdAt(LocalDateTime.now(CLOCK))
                .build();
        when(optimizationResultMetricRepository.findAllByResultId(555L))
                .thenReturn(List.of(betaMetric));

        OptimizationResultResponse response = service.getResult(ACTOR_USERNAME, REQUEST_ID);

        assertThat(response.generatedAt()).isEqualTo(LocalDateTime.now(CLOCK));
        assertThat(response.assets()).hasSize(2);

        OptimizationResultAssetResponse akbnkResponse = response.assets().stream()
                .filter(asset -> asset.assetCode().equals("AKBNK.E"))
                .findFirst()
                .orElseThrow();
        assertThat(akbnkResponse.name()).isEqualTo("Akbank T.A.Ş.");
        assertThat(akbnkResponse.sectorName()).isEqualTo("Bankacılık");
        assertThat(akbnkResponse.currentWeight()).isEqualByComparingTo("50");
        assertThat(akbnkResponse.proposedWeight()).isEqualByComparingTo("45");
        assertThat(akbnkResponse.finalWeight()).isEqualByComparingTo("40");
        assertThat(akbnkResponse.changeAmount()).isEqualByComparingTo("-5");
        assertThat(akbnkResponse.manuallyOverridden()).isTrue();

        OptimizationResultAssetResponse tppResponse = response.assets().stream()
                .filter(asset -> asset.assetCode().equals("TPP1G"))
                .findFirst()
                .orElseThrow();
        assertThat(tppResponse.name()).isEqualTo("TPP1G");
        assertThat(tppResponse.sectorName()).isNull();
        assertThat(tppResponse.finalWeight()).isNull();

        assertThat(response.metrics()).hasSize(1);
        assertThat(response.metrics().getFirst().key()).isEqualTo("BETA");
        assertThat(response.metrics().getFirst().currentValue()).isEqualByComparingTo("1.10");
        assertThat(response.metrics().getFirst().proposedValue()).isEqualByComparingTo("0.95");
    }

    @Test
    void getResult_withNoResultYet_throwsResultNotFound() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.PREPARING)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(optimizationResultRepository.findFirstByRequestIdOrderByIdDesc(REQUEST_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getResult(ACTOR_USERNAME, REQUEST_ID))
                .isInstanceOf(BaseException.class)
                .extracting(error -> ((BaseException) error).getErrorCode())
                .isEqualTo(ErrorCode.OPT_RESULT_NOT_FOUND);
    }

    @Test
    void getById_includesTheRequestsOwnConstraintTargets() {
        User actor = User.builder()
                .id(7L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.PREPARING)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findById(REQUEST_ID)).thenReturn(Optional.of(request));
        when(requestConstraintTargetRepository.findAllByRequestId(REQUEST_ID)).thenReturn(List.of(
                constraintTarget(OptimizationConstraintCode.TPP_MIN, BigDecimal.valueOf(5), null),
                constraintTarget(OptimizationConstraintCode.TPP_MAX, null, BigDecimal.valueOf(15)),
                constraintTarget(OptimizationConstraintCode.STOCK_COUNT_MIN, BigDecimal.valueOf(16), null),
                constraintTarget(OptimizationConstraintCode.STOCK_COUNT_MAX, null, BigDecimal.valueOf(30))
        ));

        OptimizationRequestResponse response = service.getById(ACTOR_USERNAME, REQUEST_ID);

        assertThat(response.tppMinWeight()).isEqualByComparingTo("5");
        assertThat(response.tppMaxWeight()).isEqualByComparingTo("15");
        assertThat(response.stockCountMin()).isEqualTo(16);
        assertThat(response.stockCountMax()).isEqualTo(30);
    }

    @Test
    void listLogs_forNonAdminActor_returnsOnlyTheirOwnDecidedOrFailedRequestsWithFundNamesAndResultAvailability() {
        User actor = User.builder()
                .id(7L)
                .role(Role.USER)
                .username(ACTOR_USERNAME)
                .build();

        User approver = User.builder()
                .id(3L)
                .role(Role.ADMIN)
                .username("onaylayan")
                .firstName("Onay")
                .lastName("Veren")
                .build();

        UUID otherFundId = UUID.fromString("22222222-2222-4222-8222-222222222222");
        UUID runningFundId = UUID.fromString("33333333-3333-4333-8333-333333333333");

        OptimizationRequest approvedRequest = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .decidedBy(approver)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.APPROVED)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        OptimizationRequest failedRequest = OptimizationRequest.builder()
                .id(43L)
                .fundId(otherFundId)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.FAILED)
                .errorMessage("Motor sunucusuna bağlanılamadı")
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        OptimizationRequest runningRequest = OptimizationRequest.builder()
                .id(44L)
                .fundId(runningFundId)
                .requestedBy(actor)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.RUNNING)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findAllByRequestedByIdOrderByCreatedAtDesc(7L))
                .thenReturn(List.of(approvedRequest, failedRequest, runningRequest));
        when(fundDraftRepository.findAllByPublicIdIn(
                List.of(FUND_ID, otherFundId, runningFundId)
        ))
                .thenReturn(List.of(
                        FundDraft.builder().id(10L).publicId(FUND_ID).name("Optimizasyon Stabil Fon").build(),
                        FundDraft.builder().id(11L).publicId(otherFundId).name("Aktif Hisse Fonu").build()
                ));

        List<OptimizationLogEntryResponse> logs = service.listLogs(ACTOR_USERNAME);

        assertThat(logs).hasSize(2);
        assertThat(logs).noneMatch(entry -> entry.requestId().equals(44L));

        OptimizationLogEntryResponse approvedEntry = logs.stream()
                .filter(entry -> entry.requestId().equals(REQUEST_ID))
                .findFirst()
                .orElseThrow();
        assertThat(approvedEntry.fundName()).isEqualTo("Optimizasyon Stabil Fon");
        assertThat(approvedEntry.status()).isEqualTo(RequestStatus.APPROVED);
        assertThat(approvedEntry.resultAvailable()).isTrue();
        assertThat(approvedEntry.decidedByUsername()).isEqualTo("onaylayan");
        assertThat(approvedEntry.decidedByDisplayName()).isEqualTo("Onay Veren");

        OptimizationLogEntryResponse failedEntry = logs.stream()
                .filter(entry -> entry.requestId().equals(43L))
                .findFirst()
                .orElseThrow();
        assertThat(failedEntry.fundName()).isEqualTo("Aktif Hisse Fonu");
        assertThat(failedEntry.status()).isEqualTo(RequestStatus.FAILED);
        assertThat(failedEntry.resultAvailable()).isFalse();
        assertThat(failedEntry.errorMessage()).isEqualTo("Motor sunucusuna bağlanılamadı");

        verify(optimizationRequestRepository, org.mockito.Mockito.never()).findAllByOrderByCreatedAtDesc();
    }

    @Test
    void listLogs_includesRejectionReasonForRejectedRequest() {
        User actor = User.builder()
                .id(7L)
                .role(Role.USER)
                .username(ACTOR_USERNAME)
                .firstName("Talep")
                .lastName("Eden")
                .build();

        User rejector = User.builder()
                .id(3L)
                .role(Role.ADMIN)
                .username("onaylayan")
                .firstName("Onay")
                .lastName("Veren")
                .build();

        OptimizationRequest rejectedRequest = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(actor)
                .decidedBy(rejector)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.REJECTED)
                .rejectionReason("Sektör dağılımı hedeflere uymuyor")
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(actor));
        when(optimizationRequestRepository.findAllByRequestedByIdOrderByCreatedAtDesc(7L))
                .thenReturn(List.of(rejectedRequest));
        when(fundDraftRepository.findAllByPublicIdIn(List.of(FUND_ID)))
                .thenReturn(List.of(
                        FundDraft.builder().id(10L).publicId(FUND_ID).name("Optimizasyon Stabil Fon").build()
                ));

        List<OptimizationLogEntryResponse> logs = service.listLogs(ACTOR_USERNAME);

        assertThat(logs).hasSize(1);
        assertThat(logs.get(0).status()).isEqualTo(RequestStatus.REJECTED);
        assertThat(logs.get(0).rejectionReason()).isEqualTo("Sektör dağılımı hedeflere uymuyor");
        assertThat(logs.get(0).requestedByUsername()).isEqualTo(ACTOR_USERNAME);
        assertThat(logs.get(0).requestedByDisplayName()).isEqualTo("Talep Eden");
        assertThat(logs.get(0).decidedByDisplayName()).isEqualTo("Onay Veren");
    }

    @Test
    void listLogs_forAdminActor_returnsRequestsAcrossAllUsers() {
        User admin = User.builder()
                .id(9L)
                .role(Role.ADMIN)
                .username(ACTOR_USERNAME)
                .build();

        OptimizationRequest request = OptimizationRequest.builder()
                .id(REQUEST_ID)
                .fundId(FUND_ID)
                .requestedBy(admin)
                .riskProfile(RiskProfile.BALANCED)
                .maxAdditions(3)
                .status(RequestStatus.APPROVED)
                .version(0L)
                .createdAt(LocalDateTime.now(CLOCK))
                .updatedAt(LocalDateTime.now(CLOCK))
                .build();

        when(userRepository.findByUsername(ACTOR_USERNAME)).thenReturn(Optional.of(admin));
        when(optimizationRequestRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(request));
        when(fundDraftRepository.findAllByPublicIdIn(List.of(FUND_ID)))
                .thenReturn(List.of(FundDraft.builder().id(10L).publicId(FUND_ID).name("Optimizasyon Stabil Fon").build()));

        List<OptimizationLogEntryResponse> logs = service.listLogs(ACTOR_USERNAME);

        assertThat(logs).hasSize(1);
        assertThat(logs.get(0).resultAvailable()).isTrue();
        verify(optimizationRequestRepository, org.mockito.Mockito.never())
                .findAllByRequestedByIdOrderByCreatedAtDesc(org.mockito.ArgumentMatchers.anyLong());
    }

    private RequestConstraintTarget constraintTarget(
            OptimizationConstraintCode code,
            BigDecimal minValue,
            BigDecimal maxValue
    ) {
        return RequestConstraintTarget.builder()
                .constraintCode(code)
                .minValue(minValue)
                .maxValue(maxValue)
                .build();
    }

    private FundMonitoringResponse fundMonitoringResponse() {
        return new FundMonitoringResponse(
                new FundSummaryResponse(FUND_ID, "Test Fonu", null, "TRY", LocalDate.of(2026, 1, 1)),
                LocalDate.of(2026, 8, 8),
                "TRY",
                BigDecimal.valueOf(1000000),
                BigDecimal.TEN,
                BigDecimal.ZERO,
                Map.of(),
                null,
                List.of(),
                List.of(),
                List.of(
                        new FundPositionResponse("1", "AKBNK.E", "Akbank", "Bankalar", BigDecimal.valueOf(50)),
                        new FundPositionResponse("2", "TPP1G", "TPP", null, BigDecimal.valueOf(50))
                ),
                List.of(),
                List.of()
        );
    }

    private OptimizationEngineResult engineResult() {
        return engineResult("2025-05-29");
    }

    private OptimizationEngineResult engineResult(String systemDate) {
        return new OptimizationEngineResult(
                REQUEST_ID.toString(),
                "FROZEN_2025-05-29_V3",
                systemDate,
                "2025-05-28",
                "EQUITY_FORECAST_BUNDLE_V3",
                "PORTFOLIO_OBJECTIVES_V3_NEW_PROSPECTUS",
                42.0,
                List.of(
                        alternative("RETURN_FOCUSED"),
                        alternative("BALANCED_UTILITY"),
                        alternative("ROBUST_RISK_CONTROLLED")
                )
        );
    }

    private EngineAlternative alternative(String objectiveId) {
        boolean isBalanced = objectiveId.equals("BALANCED_UTILITY");

        Map<String, BigDecimal> weights = isBalanced
                ? Map.of("AKBNK.E", new BigDecimal("0.45"), "CASH_TPP", new BigDecimal("0.55"))
                : Map.of("AKBNK.E", new BigDecimal("0.50"), "CASH_TPP", new BigDecimal("0.50"));

        Map<String, BigDecimal> deltas = isBalanced
                ? Map.of("AKBNK.E", new BigDecimal("-0.05"), "CASH_TPP", new BigDecimal("0.05"))
                : Map.of("AKBNK.E", BigDecimal.ZERO, "CASH_TPP", BigDecimal.ZERO);

        Map<String, List<String>> reasonTexts = isBalanced
                ? Map.of("AKBNK.E", List.of("Ağırlık mevcut portföye göre azaltıldı."))
                : Map.of();

        return new EngineAlternative(
                objectiveId,
                "6M",
                weights,
                2,
                new BigDecimal("0.45"),
                new BigDecimal("0.55"),
                new BigDecimal("0.12"),
                new BigDecimal("0.16"),
                new BigDecimal("0.81"),
                Map.of("S8212", new BigDecimal("0.45")),
                new BigDecimal("0.05"),
                List.of(),
                BigDecimal.ZERO,
                new BigDecimal("0.12"),
                Map.of(),
                reasonTexts,
                "DETERMINISTIC_HEURISTIC_LOCAL_SEARCH_NOT_GLOBAL_OPTIMUM",
                deltas,
                List.of(),
                List.of(),
                Map.of(),
                new BigDecimal("0.05")
        );
    }
}
