package com.infina.portfoliomanagement.optimization.service;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.fund.repository.FundPositionRepository;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundPositionResponse;
import com.infina.portfoliomanagement.fundmonitoring.service.FundMonitoringService;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import com.infina.portfoliomanagement.optimization.dto.ApproveOptimizationRequestRequest;
import com.infina.portfoliomanagement.optimization.dto.ApproveOptimizationRequestRequest.AssetWeightOverride;
import com.infina.portfoliomanagement.optimization.dto.AssetPreferenceRequest;
import com.infina.portfoliomanagement.optimization.dto.CreateOptimizationRequestRequest;
import com.infina.portfoliomanagement.optimization.dto.OptimizationFundPositionsResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationLogEntryResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationRequestResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultAssetResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultMetricResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizableFundResponse;
import com.infina.portfoliomanagement.optimization.dto.OptimizationResultResponse;
import com.infina.portfoliomanagement.optimization.engine.EngineAlternative;
import com.infina.portfoliomanagement.optimization.engine.OptimizationEngineClient;
import com.infina.portfoliomanagement.optimization.engine.OptimizationEngineRequest;
import com.infina.portfoliomanagement.optimization.engine.OptimizationEngineResult;
import com.infina.portfoliomanagement.optimization.entity.AssetPreference;
import com.infina.portfoliomanagement.optimization.entity.OptimizationRequest;
import com.infina.portfoliomanagement.optimization.entity.OptimizationResult;
import com.infina.portfoliomanagement.optimization.entity.OptimizationResultAsset;
import com.infina.portfoliomanagement.optimization.entity.OptimizationResultMetric;
import com.infina.portfoliomanagement.optimization.entity.RequestConstraintTarget;
import com.infina.portfoliomanagement.optimization.enums.AssetPreferenceType;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OptimizationRequestService {

    private static final BigDecimal EQUITY_WEIGHT_MIN_VALUE = BigDecimal.valueOf(85);
    private static final BigDecimal EQUITY_WEIGHT_MAX_VALUE = BigDecimal.valueOf(95);
    private static final BigDecimal SECTOR_MAX_VALUE = BigDecimal.valueOf(30);
    private static final BigDecimal SINGLE_STOCK_MAX_VALUE = BigDecimal.valueOf(10);
    private static final BigDecimal TPP_WEIGHT_FLOOR = BigDecimal.valueOf(5);
    private static final BigDecimal TPP_WEIGHT_CEILING = BigDecimal.valueOf(15);
    private static final BigDecimal TPP_WEIGHT_MIN_RANGE_WIDTH = BigDecimal.valueOf(3);
    private static final int STOCK_COUNT_FLOOR = 16;
    private static final int STOCK_COUNT_CEILING = 30;
    private static final int STOCK_COUNT_MIN_RANGE_WIDTH = 5;
    private static final BigDecimal FORCE_ADD_MINIMUM_WEIGHT = new BigDecimal("3");
    private static final BigDecimal PERCENT_TO_FRACTION_DIVISOR = BigDecimal.valueOf(100);
    private static final BigDecimal MAX_WEIGHT_CHANGE_PER_ASSET_DEFAULT = new BigDecimal("0.03");
    private static final int MAX_REMOVALS_DEFAULT = 2;
    private static final BigDecimal PORTFOLIO_SUM_TOLERANCE = new BigDecimal("0.000001");
    private static final String CASH_TPP_CODE = "CASH_TPP";
    private static final Set<RequestStatus> RESULT_AVAILABLE_STATUSES = Set.of(
            RequestStatus.COMPLETED,
            RequestStatus.APPROVED,
            RequestStatus.REJECTED
    );
    private static final String OBJECTIVE_RETURN_FOCUSED = "RETURN_FOCUSED";
    private static final String OBJECTIVE_BALANCED_UTILITY = "BALANCED_UTILITY";
    private static final String OBJECTIVE_ROBUST_RISK_CONTROLLED = "ROBUST_RISK_CONTROLLED";
    private static final Map<String, String> INFO_METRIC_INDICATOR_CODES = Map.ofEntries(
            Map.entry("BETA", "BETA"),
            Map.entry("VOLATILITY", "VOLATILITY"),
            Map.entry("MAX_DRAWDOWN", "MAX_DRAWDOWN"),
            Map.entry("DOWNSIDE_DEVIATION", "DOWNSIDE_DEVIATION"),
            Map.entry("TRACKING_ERROR", "TRACKING_ERROR"),
            Map.entry("SHARPE_RATIO", "SHARPE"),
            Map.entry("CALMAR_RATIO", "CALMAR"),
            Map.entry("INFORMATION_RATIO", "INFORMATION_RATIO"),
            Map.entry("ALPHA", "ALPHA")
    );

    private final OptimizationRequestRepository optimizationRequestRepository;
    private final RequestConstraintTargetRepository requestConstraintTargetRepository;
    private final AssetPreferenceRepository assetPreferenceRepository;
    private final UserRepository userRepository;
    private final OptimizationRequestPolicy optimizationRequestPolicy;
    private final OptimizationEngineClient optimizationEngineClient;
    private final FundMonitoringService fundMonitoringService;
    private final AssetRepository assetRepository;
    private final EquityDetailRepository equityDetailRepository;
    private final OptimizationResultRepository optimizationResultRepository;
    private final OptimizationResultAssetRepository optimizationResultAssetRepository;
    private final OptimizationResultMetricRepository optimizationResultMetricRepository;
    private final FundDraftRepository fundDraftRepository;
    private final FundPortfolioRepository fundPortfolioRepository;
    private final FundPositionRepository fundPositionRepository;
    private final Clock clock;

    @Transactional
    public OptimizationRequestResponse create(String actorUsername, CreateOptimizationRequestRequest requestBody) {
        User actor = resolveActor(actorUsername);

        assertTppWeightWithinRange(requestBody.tppMinWeight(), requestBody.tppMaxWeight());
        assertStockCountWithinRange(requestBody.stockCountMin(), requestBody.stockCountMax());
        assertPreferencesValid(requestBody.assetPreferences(), requestBody.stockCountMax());

        LocalDateTime now = LocalDateTime.now(clock);

        OptimizationRequest request = OptimizationRequest.builder()
                .fundId(requestBody.fundId())
                .requestedBy(actor)
                .riskProfile(requestBody.riskProfile())
                .maxAdditions(requestBody.maxAdditions())
                .status(RequestStatus.PREPARING)
                .version(0L)
                .createdAt(now)
                .updatedAt(now)
                .build();

        OptimizationRequest saved = optimizationRequestRepository.saveAndFlush(request);

        saveConstraintTargets(saved, requestBody);
        saveAssetPreferences(saved, requestBody.assetPreferences());

        log.debug("Optimization request {} created by actor {}", saved.getId(), actor.getId());

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<OptimizableFundResponse> listOptimizableFunds(String actorUsername) {
        User actor = resolveActor(actorUsername);

        List<FundDraft> funds = fundDraftRepository
                .findAllByStatusAndCreatedByUserIdOrderByCreatedAtDescIdDesc(
                        FundDraftStatus.COMPLETED,
                        actor.getId()
                );

        return funds.stream().map(this::toOptimizableFundResponse).toList();
    }

    private OptimizableFundResponse toOptimizableFundResponse(FundDraft fund) {
        List<FundPosition> positions = fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(fund.getId(), PortfolioType.WORKING)
                .map(portfolio -> fundPositionRepository
                        .findAllByFundPortfolioIdOrderByWeightDesc(portfolio.getId()))
                .orElse(List.of());

        Map<Long, Asset> assetsById = assetRepository
                .findAllById(positions.stream().map(FundPosition::getAssetId).toList())
                .stream()
                .collect(Collectors.toMap(Asset::getId, asset -> asset));

        List<Long> equityAssetIds = positions.stream()
                .map(FundPosition::getAssetId)
                .filter(assetId -> {
                    Asset asset = assetsById.get(assetId);
                    return asset != null && asset.getAssetType() == AssetType.EQUITY;
                })
                .toList();

        Map<Long, EquityDetail> detailByAssetId = equityDetailRepository
                .findAllByAssetIdIn(equityAssetIds)
                .stream()
                .collect(Collectors.toMap(
                        EquityDetail::getAssetId,
                        detail -> detail,
                        (left, right) -> left
                ));

        BigDecimal equityWeight = BigDecimal.ZERO;
        BigDecimal tppWeight = BigDecimal.ZERO;
        Set<Long> sectorIds = new HashSet<>();
        int stockCount = 0;

        for (FundPosition position : positions) {
            Asset asset = assetsById.get(position.getAssetId());
            if (asset == null) {
                continue;
            }
            if (asset.getAssetType() == AssetType.EQUITY) {
                equityWeight = equityWeight.add(position.getWeight());
                stockCount++;
                EquityDetail detail = detailByAssetId.get(asset.getId());
                if (detail != null && detail.getSector() != null) {
                    sectorIds.add(detail.getSector().getId());
                }
            } else if (asset.getAssetType() == AssetType.TPP) {
                tppWeight = tppWeight.add(position.getWeight());
            }
        }

        LocalDate lastOptimizationDate = optimizationRequestRepository
                .findFirstByFundIdAndCompletedAtIsNotNullOrderByCompletedAtDesc(fund.getPublicId())
                .map(request -> request.getCompletedAt().toLocalDate())
                .orElse(null);

        return new OptimizableFundResponse(
                fund.getPublicId(),
                fund.getName(),
                fund.getFundType(),
                true,
                lastOptimizationDate,
                stockCount,
                sectorIds.size(),
                equityWeight.setScale(0, RoundingMode.HALF_UP),
                tppWeight.setScale(0, RoundingMode.HALF_UP)
        );
    }

    @Transactional(readOnly = true)
    public OptimizationRequestResponse getById(String actorUsername, Long requestId) {
        User actor = resolveActor(actorUsername);
        OptimizationRequest request = findRequest(requestId);

        optimizationRequestPolicy.assertCanAccess(actor, request);

        return toResponse(request);
    }

    @Transactional(readOnly = true)
    public OptimizationResultResponse getResult(String actorUsername, Long requestId) {
        User actor = resolveActor(actorUsername);
        OptimizationRequest request = findRequest(requestId);

        optimizationRequestPolicy.assertCanAccess(actor, request);

        OptimizationResult result = optimizationResultRepository
                .findFirstByRequestIdOrderByIdDesc(requestId)
                .orElseThrow(() -> new BaseException(ErrorCode.OPT_RESULT_NOT_FOUND));

        List<OptimizationResultAsset> resultAssets =
                optimizationResultAssetRepository.findAllByResultId(result.getId());

        Map<String, Asset> assetsByCode = assetRepository
                .findAllByAssetCodeIn(resultAssets.stream().map(OptimizationResultAsset::getAssetCode).toList())
                .stream()
                .collect(Collectors.toMap(Asset::getAssetCode, asset -> asset));

        Map<Long, EquityDetail> detailByAssetId = equityDetailRepository
                .findAllByAssetIdIn(assetsByCode.values().stream().map(Asset::getId).toList())
                .stream()
                .collect(Collectors.toMap(
                        EquityDetail::getAssetId,
                        detail -> detail,
                        (left, right) -> left
                ));

        List<OptimizationResultAssetResponse> assets = resultAssets.stream()
                .map(resultAsset -> toResultAssetResponse(resultAsset, assetsByCode, detailByAssetId))
                .toList();

        List<OptimizationResultMetricResponse> metrics = optimizationResultMetricRepository
                .findAllByResultId(result.getId())
                .stream()
                .map(metric -> new OptimizationResultMetricResponse(
                        metric.getMetricKey(),
                        metric.getCurrentValue(),
                        metric.getProposedValue()
                ))
                .toList();

        return new OptimizationResultResponse(result.getGeneratedAt(), assets, metrics);
    }

    private OptimizationResultAssetResponse toResultAssetResponse(
            OptimizationResultAsset resultAsset,
            Map<String, Asset> assetsByCode,
            Map<Long, EquityDetail> detailByAssetId
    ) {
        Asset asset = assetsByCode.get(resultAsset.getAssetCode());
        EquityDetail detail = asset != null ? detailByAssetId.get(asset.getId()) : null;
        BigDecimal finalWeight = resultAsset.getFinalWeight();

        return new OptimizationResultAssetResponse(
                resultAsset.getAssetCode(),
                resolveResultAssetName(resultAsset.getAssetCode(), asset, detail),
                resolveResultAssetSectorName(detail),
                resultAsset.getAssetType(),
                toPercentage(resultAsset.getCurrentWeight()),
                toPercentage(resultAsset.getProposedWeight()),
                finalWeight != null ? toPercentage(finalWeight) : null,
                toPercentage(resultAsset.getChangeAmount()),
                resultAsset.getActionType(),
                resultAsset.isManuallyOverridden(),
                resultAsset.getRationale()
        );
    }

    private static String resolveResultAssetName(String assetCode, Asset asset, EquityDetail detail) {
        if (asset != null && asset.getDisplayName() != null && !asset.getDisplayName().isBlank()) {
            return asset.getDisplayName();
        }
        if (detail != null && detail.getCompanyName() != null && !detail.getCompanyName().isBlank()) {
            return detail.getCompanyName();
        }
        return assetCode;
    }

    private static String resolveResultAssetSectorName(EquityDetail detail) {
        if (detail == null || detail.getSector() == null) {
            return null;
        }
        return detail.getSector().getName();
    }

    @Transactional(readOnly = true)
    public OptimizationFundPositionsResponse getCurrentPositions(String actorUsername, UUID fundId) {
        FundDraft fund = fundDraftRepository
                .findByPublicIdAndStatus(fundId, FundDraftStatus.COMPLETED)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_NOT_FOUND));

        List<FundPositionResponse> positions = fundMonitoringService
                .getCurrentPositions(actorUsername, fundId);

        return new OptimizationFundPositionsResponse(fund.getName(), positions);
    }

    @Transactional(readOnly = true)
    public List<OptimizationRequestResponse> listByFund(String actorUsername, UUID fundId) {
        User actor = resolveActor(actorUsername);

        List<OptimizationRequest> requests = actor.getRole() == Role.ADMIN
                ? optimizationRequestRepository.findAllByFundId(fundId)
                : optimizationRequestRepository.findAllByFundIdAndRequestedById(fundId, actor.getId());

        return requests.stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OptimizationLogEntryResponse> listLogs(String actorUsername) {
        User actor = resolveActor(actorUsername);

        List<OptimizationRequest> requests = actor.getRole() == Role.ADMIN
                ? optimizationRequestRepository.findAllByOrderByCreatedAtDesc()
                : optimizationRequestRepository.findAllByRequestedByIdOrderByCreatedAtDesc(actor.getId());

        Map<UUID, String> fundNamesById = fundDraftRepository
                .findAllByPublicIdIn(requests.stream().map(OptimizationRequest::getFundId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(FundDraft::getPublicId, FundDraft::getName, (left, right) -> left));

        return requests.stream()
                .map(request -> toLogEntryResponse(request, fundNamesById))
                .toList();
    }

    private OptimizationLogEntryResponse toLogEntryResponse(
            OptimizationRequest request,
            Map<UUID, String> fundNamesById
    ) {
        User requestedBy = request.getRequestedBy();
        return new OptimizationLogEntryResponse(
                request.getId(),
                request.getFundId(),
                fundNamesById.getOrDefault(request.getFundId(), "—"),
                requestedBy != null ? requestedBy.getUsername() : null,
                request.getStatus(),
                request.getCreatedAt(),
                request.getCompletedAt(),
                request.getUpdatedAt(),
                RESULT_AVAILABLE_STATUSES.contains(request.getStatus())
        );
    }

    @Transactional
    public OptimizationRequestResponse approve(
            String actorUsername,
            Long requestId,
            ApproveOptimizationRequestRequest overrideRequest
    ) {
        User actor = resolveActor(actorUsername);
        OptimizationRequest request = findRequest(requestId);

        optimizationRequestPolicy.assertCanAccess(actor, request);
        assertStatusIn(request, RequestStatus.COMPLETED);

        LocalDateTime now = LocalDateTime.now(clock);

        OptimizationResult result = optimizationResultRepository
                .findFirstByRequestIdOrderByIdDesc(requestId)
                .orElseThrow(() -> new BaseException(
                        ErrorCode.EXTERNAL_SERVICE_ERROR,
                        "No optimization result was found to approve for this request."
                ));
        List<OptimizationResultAsset> resultAssets =
                optimizationResultAssetRepository.findAllByResultId(result.getId());

        applyFinalWeights(resultAssets, overrideRequest, now);
        applyToFund(request, resultAssets, now);

        result.setApprovedByUserId(actor.getId());
        result.setApprovedAt(now);
        optimizationResultRepository.save(result);

        request.setStatus(RequestStatus.APPROVED);
        request.setUpdatedAt(now);
        OptimizationRequest saved = saveRequest(request);

        log.debug("Optimization request {} approved by actor {}", requestId, actor.getId());

        return toResponse(saved);
    }

    private void applyFinalWeights(
            List<OptimizationResultAsset> resultAssets,
            ApproveOptimizationRequestRequest overrideRequest,
            LocalDateTime now
    ) {
        List<AssetWeightOverride> overrides = overrideRequest == null || overrideRequest.weightOverrides() == null
                ? List.of()
                : overrideRequest.weightOverrides();

        Map<String, BigDecimal> overridesByAssetCode = overrides.stream()
                .collect(Collectors.toMap(
                        AssetWeightOverride::assetCode,
                        override -> toFraction(override.finalWeight())
                ));

        Set<String> knownAssetCodes = resultAssets.stream()
                .map(OptimizationResultAsset::getAssetCode)
                .collect(Collectors.toSet());
        Set<String> unknownAssetCodes = new HashSet<>(overridesByAssetCode.keySet());
        unknownAssetCodes.removeAll(knownAssetCodes);
        if (!unknownAssetCodes.isEmpty()) {
            throw new BaseException(
                    ErrorCode.OPT_INVALID_CONSTRAINT_VALUE,
                    "Weight override refers to assets that are not part of this optimization result: "
                            + unknownAssetCodes
            );
        }

        BigDecimal finalWeightSum = BigDecimal.ZERO;

        for (OptimizationResultAsset resultAsset : resultAssets) {
            BigDecimal override = overridesByAssetCode.get(resultAsset.getAssetCode());
            BigDecimal finalWeight = override != null ? override : resultAsset.getProposedWeight();

            resultAsset.setFinalWeight(finalWeight);
            resultAsset.setManuallyOverridden(
                    override != null && override.compareTo(resultAsset.getProposedWeight()) != 0
            );
            resultAsset.setUpdatedAt(now);
            finalWeightSum = finalWeightSum.add(finalWeight);
        }

        if (finalWeightSum.subtract(BigDecimal.ONE).abs().compareTo(PORTFOLIO_SUM_TOLERANCE) > 0) {
            throw new BaseException(
                    ErrorCode.OPT_INVALID_CONSTRAINT_VALUE,
                    "Final weights must sum to 100%, but summed to "
                            + toPercentage(finalWeightSum).stripTrailingZeros().toPlainString() + "%."
            );
        }

        optimizationResultAssetRepository.saveAll(resultAssets);
    }

    private void applyToFund(
            OptimizationRequest request,
            List<OptimizationResultAsset> resultAssets,
            LocalDateTime now
    ) {
        FundDraft fundDraft = fundDraftRepository
                .findByPublicIdAndStatus(request.getFundId(), FundDraftStatus.COMPLETED)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_NOT_FOUND));

        FundPortfolio portfolio = fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(
                        fundDraft.getId(),
                        PortfolioType.WORKING
                )
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_NOT_FOUND));

        fundPositionRepository.deleteAllByFundPortfolioId(portfolio.getId());
        fundPositionRepository.flush();

        List<FundPosition> positions = resultAssets.stream()
                .filter(resultAsset -> resultAsset.getFinalWeight().signum() > 0)
                .map(resultAsset -> {
                    Asset asset = assetRepository.findByAssetCode(resultAsset.getAssetCode())
                            .orElseThrow(() -> new BaseException(
                                    ErrorCode.EXTERNAL_SERVICE_ERROR,
                                    "Approved asset is not registered: " + resultAsset.getAssetCode()
                            ));
                    return FundPosition.builder()
                            .fundPortfolio(portfolio)
                            .assetId(asset.getId())
                            .weight(toPercentage(resultAsset.getFinalWeight()))
                            .createdAt(now)
                            .updatedAt(now)
                            .build();
                })
                .toList();

        fundPositionRepository.saveAll(positions);

        portfolio.setUpdatedAt(now);
        fundPortfolioRepository.save(portfolio);
    }

    @Transactional
    public OptimizationRequestResponse reject(String actorUsername, Long requestId) {
        User actor = resolveActor(actorUsername);
        OptimizationRequest request = findRequest(requestId);

        optimizationRequestPolicy.assertCanAccess(actor, request);
        assertStatusIn(request, RequestStatus.COMPLETED);

        request.setStatus(RequestStatus.REJECTED);
        request.setUpdatedAt(LocalDateTime.now(clock));
        OptimizationRequest saved = saveRequest(request);

        log.debug("Optimization request {} rejected by actor {}", requestId, actor.getId());

        return toResponse(saved);
    }

    @Transactional
    public OptimizationRequestResponse run(String actorUsername, Long requestId) {
        User actor = resolveActor(actorUsername);
        OptimizationRequest request = findRequest(requestId);

        optimizationRequestPolicy.assertCanAccess(actor, request);
        assertStatusIn(request, RequestStatus.PREPARING, RequestStatus.FAILED);

        request.setStatus(RequestStatus.RUNNING);
        request.setStartedAt(LocalDateTime.now(clock));
        request.setErrorMessage(null);
        request.setUpdatedAt(LocalDateTime.now(clock));
        saveRequest(request);

        try {
            OptimizationEngineRequest engineRequest = buildEngineRequest(request, actorUsername);
            OptimizationEngineResult engineResult = optimizationEngineClient.run(engineRequest);
            EngineAlternative alternative = selectAlternative(engineResult, request.getRiskProfile());

            OptimizationResult result = persistResult(request, engineRequest, alternative);
            persistMetrics(request, actorUsername, alternative, result, LocalDateTime.now(clock));

            request.setStatus(RequestStatus.COMPLETED);
            request.setModelVersion(engineResult.snapshotId());
            request.setCompletedAt(LocalDateTime.now(clock));
            request.setUpdatedAt(LocalDateTime.now(clock));
            OptimizationRequest saved = saveRequest(request);

            log.debug(
                    "Optimization request {} completed with engine snapshot {} and objective {}",
                    requestId,
                    engineResult.snapshotId(),
                    alternative.objectiveId()
            );

            return toResponse(saved);
        } catch (BaseException e) {
            request.setStatus(RequestStatus.FAILED);
            request.setErrorMessage(e.getMessage());
            request.setCompletedAt(LocalDateTime.now(clock));
            request.setUpdatedAt(LocalDateTime.now(clock));
            saveRequest(request);

            log.debug("Optimization request {} failed: {}", requestId, e.getMessage());

            throw e;
        }
    }

    private OptimizationEngineRequest buildEngineRequest(OptimizationRequest request, String actorUsername) {
        Map<OptimizationConstraintCode, RequestConstraintTarget> targetsByCode =
                resolveConstraintTargetsByCode(request);

        int minStockCount = targetsByCode.get(OptimizationConstraintCode.STOCK_COUNT_MIN)
                .getMinValue().intValue();
        int maxStockCount = targetsByCode.get(OptimizationConstraintCode.STOCK_COUNT_MAX)
                .getMaxValue().intValue();
        BigDecimal tppMinWeight = toFraction(
                targetsByCode.get(OptimizationConstraintCode.TPP_MIN).getMinValue()
        );
        BigDecimal tppMaxWeight = toFraction(
                targetsByCode.get(OptimizationConstraintCode.TPP_MAX).getMaxValue()
        );

        Map<String, BigDecimal> currentPortfolio = resolveCurrentPortfolio(request, actorUsername);
        Map<String, BigDecimal> lockedAssets = resolveLockedAssets(request);
        List<String> mandatoryAssets = resolveAssetCodesByPreferenceType(request, AssetPreferenceType.FORCE_ADD);
        List<String> excludedAssets = resolveAssetCodesByPreferenceType(request, AssetPreferenceType.EXCLUDE);

        return new OptimizationEngineRequest(
                request.getId().toString(),
                resolveHorizon(request.getRiskProfile()),
                currentPortfolio,
                lockedAssets,
                mandatoryAssets,
                excludedAssets,
                minStockCount,
                maxStockCount,
                tppMinWeight,
                tppMaxWeight,
                MAX_WEIGHT_CHANGE_PER_ASSET_DEFAULT,
                request.getMaxAdditions(),
                MAX_REMOVALS_DEFAULT,
                null
        );
    }

    private EngineAlternative selectAlternative(OptimizationEngineResult engineResult, RiskProfile riskProfile) {
        String objectiveId = resolveObjectiveId(riskProfile);

        return engineResult.alternatives().stream()
                .filter(alternative -> alternative.objectiveId().equals(objectiveId))
                .findFirst()
                .orElseThrow(() -> new BaseException(
                        ErrorCode.EXTERNAL_SERVICE_ERROR,
                        "Engine response did not include the expected objective: " + objectiveId
                ));
    }

    private String resolveObjectiveId(RiskProfile riskProfile) {
        return switch (riskProfile) {
            case AGGRESSIVE -> OBJECTIVE_RETURN_FOCUSED;
            case BALANCED -> OBJECTIVE_BALANCED_UTILITY;
            case CONSERVATIVE -> OBJECTIVE_ROBUST_RISK_CONTROLLED;
        };
    }

    private OptimizationResult persistResult(
            OptimizationRequest request,
            OptimizationEngineRequest engineRequest,
            EngineAlternative alternative
    ) {
        LocalDateTime now = LocalDateTime.now(clock);

        OptimizationResult result = optimizationResultRepository.saveAndFlush(
                OptimizationResult.builder()
                        .request(request)
                        .generatedAt(now)
                        .createdAt(now)
                        .build()
        );

        String tppAssetCode = resolveTppAssetCode();

        Set<String> assetCodes = new HashSet<>(engineRequest.currentPortfolio().keySet());
        assetCodes.addAll(alternative.weights().keySet());

        List<OptimizationResultAsset> resultAssets = assetCodes.stream()
                .map(code -> buildResultAsset(result, code, engineRequest, alternative, tppAssetCode, now))
                .toList();

        optimizationResultAssetRepository.saveAll(resultAssets);

        return result;
    }

    private void persistMetrics(
            OptimizationRequest request,
            String actorUsername,
            EngineAlternative alternative,
            OptimizationResult result,
            LocalDateTime now
    ) {
        List<FundMonitoringResponse.TechnicalIndicatorResponse> currentIndicators =
                fundMonitoringService.getMonitoringSnapshot(actorUsername, request.getFundId())
                        .technicalIndicators();

        String tppAssetCode = resolveTppAssetCode();
        Map<String, BigDecimal> proposedWeights = alternative.weights().entrySet().stream()
                .collect(Collectors.toMap(
                        entry -> entry.getKey().equals(CASH_TPP_CODE) ? tppAssetCode : entry.getKey(),
                        Map.Entry::getValue
                ));
        List<FundMonitoringResponse.TechnicalIndicatorResponse> proposedIndicators =
                fundMonitoringService.computeMetricsForWeights(actorUsername, request.getFundId(), proposedWeights);

        List<OptimizationResultMetric> metrics = INFO_METRIC_INDICATOR_CODES.entrySet().stream()
                .map(entry -> OptimizationResultMetric.builder()
                        .result(result)
                        .metricKey(entry.getKey())
                        .currentValue(resolveIndicatorValue(currentIndicators, entry.getValue()))
                        .proposedValue(resolveIndicatorValue(proposedIndicators, entry.getValue()))
                        .createdAt(now)
                        .build())
                .toList();

        optimizationResultMetricRepository.saveAll(metrics);
    }

    private BigDecimal resolveIndicatorValue(
            List<FundMonitoringResponse.TechnicalIndicatorResponse> indicators,
            String indicatorCode
    ) {
        return indicators.stream()
                .filter(indicator -> indicator.code().equals(indicatorCode))
                .findFirst()
                .map(FundMonitoringResponse.TechnicalIndicatorResponse::value)
                .orElse(null);
    }

    private OptimizationResultAsset buildResultAsset(
            OptimizationResult result,
            String assetCode,
            OptimizationEngineRequest engineRequest,
            EngineAlternative alternative,
            String tppAssetCode,
            LocalDateTime now
    ) {
        BigDecimal currentWeight = engineRequest.currentPortfolio().getOrDefault(assetCode, BigDecimal.ZERO);
        BigDecimal proposedWeight = alternative.weights().getOrDefault(assetCode, BigDecimal.ZERO);
        BigDecimal changeAmount = proposedWeight.subtract(currentWeight);

        boolean isCashTpp = assetCode.equals(CASH_TPP_CODE);
        String storedAssetCode = isCashTpp ? tppAssetCode : assetCode;
        AssetType assetType = isCashTpp ? AssetType.TPP : AssetType.EQUITY;

        List<String> reasonTexts = alternative.reasonTexts().getOrDefault(assetCode, List.of());

        return OptimizationResultAsset.builder()
                .result(result)
                .assetCode(storedAssetCode)
                .assetType(assetType)
                .currentWeight(currentWeight)
                .proposedWeight(proposedWeight)
                .changeAmount(changeAmount)
                .actionType(resolveActionType(changeAmount))
                .manuallyOverridden(false)
                .rationale(reasonTexts.isEmpty() ? null : String.join(" ", reasonTexts))
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private ResultActionType resolveActionType(BigDecimal changeAmount) {
        int signum = changeAmount.signum();
        if (signum > 0) {
            return ResultActionType.INCREASE;
        }
        if (signum < 0) {
            return ResultActionType.DECREASE;
        }
        return ResultActionType.KEEP;
    }

    private Map<String, BigDecimal> resolveCurrentPortfolio(OptimizationRequest request, String actorUsername) {
        List<FundPositionResponse> currentPositions = fundMonitoringService
                .getCurrentPositions(actorUsername, request.getFundId());
        String tppAssetCode = resolveTppAssetCode();

        Map<Long, Asset> assetsById = assetRepository
                .findAllById(currentPositions.stream()
                        .map(position -> Long.valueOf(position.assetId()))
                        .toList())
                .stream()
                .collect(Collectors.toMap(Asset::getId, asset -> asset));

        Map<String, BigDecimal> currentPortfolio = new LinkedHashMap<>();
        for (FundPositionResponse position : currentPositions) {
            Asset asset = assetsById.get(Long.valueOf(position.assetId()));
            String canonicalAssetCode = asset == null ? position.symbol() : asset.getAssetCode();
            String assetCode = canonicalAssetCode.equals(tppAssetCode) ? CASH_TPP_CODE : canonicalAssetCode;
            currentPortfolio.put(assetCode, toFraction(position.weightPercentage()));
        }
        return normalizeSumToOne(currentPortfolio);
    }

    private Map<String, BigDecimal> normalizeSumToOne(Map<String, BigDecimal> fractions) {
        if (fractions.isEmpty()) {
            return fractions;
        }

        BigDecimal sum = fractions.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remainder = BigDecimal.ONE.subtract(sum);
        if (remainder.compareTo(BigDecimal.ZERO) == 0) {
            return fractions;
        }

        String largestAssetCode = fractions.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElseThrow();
        fractions.put(largestAssetCode, fractions.get(largestAssetCode).add(remainder));
        return fractions;
    }

    private String resolveTppAssetCode() {
        return assetRepository
                .findAllByAssetTypeAndActiveTrueOrderByAssetCodeAsc(AssetType.TPP)
                .stream()
                .map(asset -> asset.getAssetCode())
                .findFirst()
                .orElseThrow(() -> new BaseException(
                        ErrorCode.EXTERNAL_SERVICE_ERROR,
                        "No active TPP asset is configured."
                ));
    }

    private Map<OptimizationConstraintCode, RequestConstraintTarget> resolveConstraintTargetsByCode(
            OptimizationRequest request
    ) {
        return requestConstraintTargetRepository
                .findAllByRequestId(request.getId())
                .stream()
                .collect(Collectors.toMap(RequestConstraintTarget::getConstraintCode, target -> target));
    }

    private List<String> resolveAssetCodesByPreferenceType(
            OptimizationRequest request,
            AssetPreferenceType preferenceType
    ) {
        List<AssetPreference> preferences = assetPreferenceRepository
                .findAllByRequestId(request.getId())
                .stream()
                .filter(AssetPreference::isActive)
                .filter(preference -> preference.getPreferenceType() == preferenceType)
                .toList();

        Map<String, String> canonicalByRaw = resolveCanonicalAssetCodes(
                preferences.stream().map(AssetPreference::getAssetCode).toList()
        );
        String tppAssetCode = resolveTppAssetCode();

        return preferences.stream()
                .map(preference -> aliasTppCode(
                        canonicalByRaw.getOrDefault(preference.getAssetCode(), preference.getAssetCode()),
                        tppAssetCode
                ))
                .toList();
    }

    private Map<String, BigDecimal> resolveLockedAssets(OptimizationRequest request) {
        List<AssetPreference> preferences = assetPreferenceRepository
                .findAllByRequestId(request.getId())
                .stream()
                .filter(AssetPreference::isActive)
                .filter(preference -> preference.getPreferenceType() == AssetPreferenceType.KEEP)
                .toList();

        Map<String, String> canonicalByRaw = resolveCanonicalAssetCodes(
                preferences.stream().map(AssetPreference::getAssetCode).toList()
        );
        String tppAssetCode = resolveTppAssetCode();

        return preferences.stream()
                .collect(Collectors.toMap(
                        preference -> aliasTppCode(
                                canonicalByRaw.getOrDefault(preference.getAssetCode(), preference.getAssetCode()),
                                tppAssetCode
                        ),
                        preference -> toFraction(preference.getCurrentWeight())
                ));
    }

    private String aliasTppCode(String canonicalAssetCode, String tppAssetCode) {
        return canonicalAssetCode.equals(tppAssetCode) ? CASH_TPP_CODE : canonicalAssetCode;
    }

    private Map<String, String> resolveCanonicalAssetCodes(List<String> rawCodes) {
        List<String> distinctRawCodes = rawCodes.stream().distinct().toList();
        if (distinctRawCodes.isEmpty()) {
            return Map.of();
        }

        Map<String, String> canonicalByRaw = new HashMap<>();
        assetRepository.findAllByAssetCodeIn(distinctRawCodes)
                .forEach(asset -> canonicalByRaw.put(asset.getAssetCode(), asset.getAssetCode()));

        List<String> unresolved = distinctRawCodes.stream()
                .filter(code -> !canonicalByRaw.containsKey(code))
                .toList();
        if (!unresolved.isEmpty()) {
            assetRepository.findAllByQueryCodeIn(unresolved)
                    .forEach(asset -> canonicalByRaw.put(asset.getQueryCode(), asset.getAssetCode()));
        }

        return canonicalByRaw;
    }

    private String resolveHorizon(RiskProfile riskProfile) {
        return switch (riskProfile) {
            case AGGRESSIVE -> "3M";
            case BALANCED -> "6M";
            case CONSERVATIVE -> "12M";
        };
    }

    private BigDecimal toFraction(BigDecimal percentageValue) {
        return percentageValue.divide(PERCENT_TO_FRACTION_DIVISOR, 6, RoundingMode.HALF_UP);
    }

    private BigDecimal toPercentage(BigDecimal fractionValue) {
        return fractionValue.multiply(PERCENT_TO_FRACTION_DIVISOR);
    }

    private void saveConstraintTargets(OptimizationRequest request, CreateOptimizationRequestRequest requestBody) {
        LocalDateTime now = LocalDateTime.now(clock);

        List<RequestConstraintTarget> targets = List.of(
                buildTarget(request, OptimizationConstraintCode.EQUITY_WEIGHT_MIN, EQUITY_WEIGHT_MIN_VALUE, null, now),
                buildTarget(request, OptimizationConstraintCode.EQUITY_WEIGHT_MAX, null, EQUITY_WEIGHT_MAX_VALUE, now),
                buildTarget(request, OptimizationConstraintCode.TPP_MIN, requestBody.tppMinWeight(), null, now),
                buildTarget(request, OptimizationConstraintCode.TPP_MAX, null, requestBody.tppMaxWeight(), now),
                buildTarget(request, OptimizationConstraintCode.SINGLE_STOCK_MAX, null, SINGLE_STOCK_MAX_VALUE, now),
                buildTarget(request, OptimizationConstraintCode.STOCK_COUNT_MIN, BigDecimal.valueOf(requestBody.stockCountMin()), null, now),
                buildTarget(request, OptimizationConstraintCode.STOCK_COUNT_MAX, null, BigDecimal.valueOf(requestBody.stockCountMax()), now),
                buildTarget(request, OptimizationConstraintCode.SECTOR_MAX, null, SECTOR_MAX_VALUE, now)
        );

        requestConstraintTargetRepository.saveAll(targets);
    }

    private RequestConstraintTarget buildTarget(
            OptimizationRequest request,
            OptimizationConstraintCode code,
            BigDecimal minValue,
            BigDecimal maxValue,
            LocalDateTime now
    ) {
        return RequestConstraintTarget.builder()
                .request(request)
                .constraintCode(code)
                .minValue(minValue)
                .maxValue(maxValue)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private void saveAssetPreferences(OptimizationRequest request, List<AssetPreferenceRequest> preferences) {
        if (preferences == null || preferences.isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now(clock);

        List<AssetPreference> entities = preferences.stream()
                .map(preference -> AssetPreference.builder()
                        .request(request)
                        .assetCode(preference.assetCode())
                        .preferenceType(preference.preferenceType())
                        .currentWeight(preference.currentWeight())
                        .fixedWeight(resolveFixedWeight(preference))
                        .active(true)
                        .createdAt(now)
                        .updatedAt(now)
                        .build())
                .toList();

        assetPreferenceRepository.saveAll(entities);
    }

    private BigDecimal resolveFixedWeight(AssetPreferenceRequest preference) {
        return switch (preference.preferenceType()) {
            case KEEP -> preference.currentWeight();
            case FORCE_ADD -> FORCE_ADD_MINIMUM_WEIGHT;
            case EXCLUDE, CANDIDATE_ADD -> null;
        };
    }

    private void assertPreferencesValid(List<AssetPreferenceRequest> preferences, Integer stockCountMax) {
        if (preferences == null || preferences.isEmpty()) {
            return;
        }

        for (AssetPreferenceRequest preference : preferences) {
            if (preference.preferenceType() == AssetPreferenceType.KEEP && preference.currentWeight() == null) {
                throw new BaseException(
                        ErrorCode.OPT_INVALID_CONSTRAINT_VALUE,
                        "Current weight is required for a KEEP asset preference."
                );
            }
        }

        Set<String> excludedAssetCodes = preferences.stream()
                .filter(preference -> preference.preferenceType() == AssetPreferenceType.EXCLUDE)
                .map(AssetPreferenceRequest::assetCode)
                .collect(Collectors.toSet());

        boolean hasExcludeForceAddConflict = preferences.stream()
                .filter(preference -> preference.preferenceType() == AssetPreferenceType.FORCE_ADD)
                .map(AssetPreferenceRequest::assetCode)
                .anyMatch(excludedAssetCodes::contains);

        if (hasExcludeForceAddConflict) {
            throw new BaseException(
                    ErrorCode.OPT_ASSET_PREFERENCE_CONFLICT,
                    "An asset cannot be both excluded and force-added in the same request."
            );
        }

        long keepCount = preferences.stream()
                .filter(preference -> preference.preferenceType() == AssetPreferenceType.KEEP)
                .count();

        if (keepCount > stockCountMax) {
            throw new BaseException(
                    ErrorCode.OPT_INVALID_CONSTRAINT_VALUE,
                    "The number of kept assets must not exceed the maximum stock count."
            );
        }

        BigDecimal keptWeightSum = preferences.stream()
                .filter(preference -> preference.preferenceType() == AssetPreferenceType.KEEP)
                .map(AssetPreferenceRequest::currentWeight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long forceAddCount = preferences.stream()
                .filter(preference -> preference.preferenceType() == AssetPreferenceType.FORCE_ADD)
                .count();

        BigDecimal reservedWeight = keptWeightSum.add(FORCE_ADD_MINIMUM_WEIGHT.multiply(BigDecimal.valueOf(forceAddCount)));

        if (reservedWeight.compareTo(EQUITY_WEIGHT_MAX_VALUE) > 0) {
            throw new BaseException(
                    ErrorCode.OPT_INVALID_CONSTRAINT_VALUE,
                    "Kept and force-added asset weights exceed the maximum usable equity weight."
            );
        }
    }

    private void assertTppWeightWithinRange(BigDecimal min, BigDecimal max) {
        if (min == null || max == null || min.compareTo(TPP_WEIGHT_FLOOR) < 0
                || max.compareTo(TPP_WEIGHT_CEILING) > 0 || min.compareTo(max) > 0
                || max.subtract(min).compareTo(TPP_WEIGHT_MIN_RANGE_WIDTH) < 0) {
            throw new BaseException(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
        }
    }

    private void assertStockCountWithinRange(Integer min, Integer max) {
        if (min == null || max == null || min < STOCK_COUNT_FLOOR || max > STOCK_COUNT_CEILING
                || min > max || max - min < STOCK_COUNT_MIN_RANGE_WIDTH) {
            throw new BaseException(ErrorCode.OPT_INVALID_CONSTRAINT_VALUE);
        }
    }

    private User resolveActor(String actorUsername) {
        return userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
    }

    private OptimizationRequest findRequest(Long requestId) {
        return optimizationRequestRepository.findById(requestId)
                .orElseThrow(() -> new BaseException(ErrorCode.OPT_REQUEST_NOT_FOUND));
    }

    private void assertStatusIn(OptimizationRequest request, RequestStatus... allowedStatuses) {
        for (RequestStatus allowedStatus : allowedStatuses) {
            if (request.getStatus() == allowedStatus) {
                return;
            }
        }

        log.debug(
                "Optimization request {} status transition denied: currentStatus={}",
                request.getId(),
                request.getStatus()
        );
        throw new BaseException(ErrorCode.OPT_INVALID_STATUS_TRANSITION);
    }

    private OptimizationRequest saveRequest(OptimizationRequest request) {
        try {
            return optimizationRequestRepository.saveAndFlush(request);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw new BaseException(ErrorCode.OPT_VERSION_CONFLICT);
        }
    }

    private OptimizationRequestResponse toResponse(OptimizationRequest request) {
        User requestedBy = request.getRequestedBy();
        Map<OptimizationConstraintCode, RequestConstraintTarget> targetsByCode =
                resolveConstraintTargetsByCode(request);

        RequestConstraintTarget tppMin = targetsByCode.get(OptimizationConstraintCode.TPP_MIN);
        RequestConstraintTarget tppMax = targetsByCode.get(OptimizationConstraintCode.TPP_MAX);
        RequestConstraintTarget stockCountMin = targetsByCode.get(OptimizationConstraintCode.STOCK_COUNT_MIN);
        RequestConstraintTarget stockCountMax = targetsByCode.get(OptimizationConstraintCode.STOCK_COUNT_MAX);

        return new OptimizationRequestResponse(
                request.getId(),
                request.getFundId(),
                request.getDataTimestamp(),
                request.getModelVersion(),
                requestedBy != null ? requestedBy.getId() : null,
                requestedBy != null ? requestedBy.getUsername() : null,
                request.getRiskProfile(),
                request.getStatus(),
                request.getMaxAdditions(),
                tppMin != null ? tppMin.getMinValue() : null,
                tppMax != null ? tppMax.getMaxValue() : null,
                stockCountMin != null ? stockCountMin.getMinValue().intValue() : null,
                stockCountMax != null ? stockCountMax.getMaxValue().intValue() : null,
                request.getStartedAt(),
                request.getCompletedAt(),
                request.getErrorMessage(),
                request.getCreatedAt(),
                request.getUpdatedAt()
        );
    }
}
