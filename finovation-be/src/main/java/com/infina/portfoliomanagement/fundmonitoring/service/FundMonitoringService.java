package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.fund.repository.FundPositionRepository;
import com.infina.portfoliomanagement.fundmonitoring.classification.AssetClassificationProviderRegistry;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundPositionResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundComparisonAssetResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.PricePointResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.SectorAllocationResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundSummaryResponse;
import com.infina.portfoliomanagement.fundmonitoring.service.FundBenchmarkService.BenchmarkSnapshot;
import com.infina.portfoliomanagement.fundmonitoring.model.AssetMonitoringProfile;
import com.infina.portfoliomanagement.fundmonitoring.model.FundRebalanceSnapshot;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationPoint;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationResult;
import com.infina.portfoliomanagement.fundmonitoring.model.ValuedFundPosition;
import com.infina.portfoliomanagement.fundmonitoring.policy.FundMonitoringAccessPolicy;
import com.infina.portfoliomanagement.fundmonitoring.valuation.AssetValuationProviderRegistry;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FundMonitoringService {

    private static final int ANNUAL_HISTORY_LOOKBACK_BUFFER_DAYS = 45;
    private static final List<String> COMPARISON_COLORS = List.of(
            "#0d9488",
            "#2563eb",
            "#7c3aed",
            "#ea580c",
            "#0891b2",
            "#be123c"
    );

    private final FundDraftRepository fundDraftRepository;
    private final FundPortfolioRepository fundPortfolioRepository;
    private final FundPositionRepository fundPositionRepository;
    private final AssetRepository assetRepository;
    private final UserRepository userRepository;
    private final FundMonitoringAccessPolicy accessPolicy;
    private final AssetValuationProviderRegistry valuationProviderRegistry;
    private final AssetClassificationProviderRegistry classificationProviderRegistry;
    private final FundValuationCalculator valuationCalculator;
    private final FundRebalanceService fundRebalanceService;
    private final FundMetricCalculator metricCalculator;
    private final FundBenchmarkService benchmarkService;
    private final SimilarFundService similarFundService;
    private final RiskFreeRateProvider riskFreeRateProvider;
    private final FinancialTimeProvider financialTime;

    @Transactional(readOnly = true)
    public List<FundSummaryResponse> listFunds(
            String actorUsername,
            Long ownerUserId
    ) {
        User actor = requireActor(actorUsername);
        Long effectiveOwnerUserId = actor.getId();

        if (ownerUserId != null && !ownerUserId.equals(actor.getId())) {
            User owner = userRepository.findById(ownerUserId)
                    .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
            accessPolicy.assertCanViewUserFunds(actor, owner);
            effectiveOwnerUserId = owner.getId();
        }

        return fundDraftRepository
                .findAllByStatusAndCreatedByUserIdOrderByCreatedAtDescIdDesc(
                        FundDraftStatus.COMPLETED,
                        effectiveOwnerUserId
                ).stream()
                .map(FundSummaryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public FundMonitoringResponse getMonitoringSnapshot(
            String actorUsername,
            UUID fundPublicId
    ) {
        User actor = requireActor(actorUsername);
        FundDraft fund = fundDraftRepository
                .findByPublicIdAndStatus(fundPublicId, FundDraftStatus.COMPLETED)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_NOT_FOUND));
        accessPolicy.assertCanView(fund, actor.getId());

        LocalDate today = financialTime.currentDate();
        FundMonitoringCalculation calculation = calculateFund(fund, today);
        List<Asset> assets = calculation.assets();
        FundValuationResult trackingValuation = calculation.trackingValuation();
        FundValuationResult backtestValuation = calculation.backtestValuation();

        Map<Long, AssetMonitoringProfile> profilesByAssetId =
                classificationProviderRegistry.loadProfiles(assets);

        List<FundPositionResponse> positions = positions(trackingValuation, profilesByAssetId);
        List<SectorAllocationResponse> sectors = sectors(trackingValuation, profilesByAssetId);

        BigDecimal liquidityRatio = trackingValuation.positions().stream()
                .filter(position -> requireProfile(
                        profilesByAssetId,
                        position.asset().getId()
                ).liquid())
                .map(ValuedFundPosition::currentWeightPercentage)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(4, RoundingMode.HALF_UP);
        List<FundValuationPoint> trackingPoints = trackingValuation.points();
        FundValuationPoint trackingLatest = latestValuationPoint(trackingPoints);
        List<FundValuationPoint> backtestPoints = backtestValuation.points();
        FundValuationPoint backtestLatest = latestValuationPoint(backtestPoints);
        List<FundValuationPoint> annualBacktestPoints = valuationPointsSince(
                backtestPoints,
                backtestLatest.date().minusYears(1)
        );
        BenchmarkSnapshot benchmarks;
        List<FundComparisonAssetResponse> similarFundAssets;
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            CompletableFuture<BenchmarkSnapshot> benchmarkFuture =
                    CompletableFuture.supplyAsync(
                            () -> benchmarkService.load(backtestLatest.date()),
                            executor
                    );
            CompletableFuture<List<FundComparisonAssetResponse>> similarFundsFuture =
                    CompletableFuture.supplyAsync(
                            () -> similarFundService.comparisonAssets(
                                    fund.getFundType(),
                                    backtestLatest.date()
                            ),
                            executor
                    );
            benchmarks = benchmarkFuture.join();
            similarFundAssets = similarFundsFuture.join();
        }
        BigDecimal annualRiskFreeRate = riskFreeRateProvider.annualRate(
                backtestLatest.date()
        );

        log.info(
                "Fund monitoring snapshot calculated for fund {} at {} with {} valuation point(s)",
                fund.getPublicId(),
                trackingLatest.date(),
                trackingPoints.size()
        );

        return new FundMonitoringResponse(
                FundSummaryResponse.from(fund),
                trackingLatest.date(),
                fund.getCurrencyCode(),
                trackingValuation.outstandingShares(),
                trackingLatest.sharePrice(),
                metricCalculator.dailyChange(trackingPoints),
                priceHistory(trackingPoints, trackingLatest.date()),
                normalizedBacktestHistory(backtestPoints, backtestLatest.date()),
                normalizedBacktestPeriodValue(annualBacktestPoints),
                metricCalculator.dailyChange(backtestPoints),
                benchmarks.benchmarkDefinition(),
                metricCalculator.technicalIndicators(
                        backtestPoints,
                        benchmarks.benchmarkValues(),
                        annualRiskFreeRate,
                        liquidityRatio
                ),
                metricCalculator.periodReturns(backtestPoints, backtestLatest.date()),
                positions,
                sectors,
                comparisonAssets(
                        fund,
                        backtestValuation,
                        actor.getId(),
                        today,
                        similarFundAssets,
                        benchmarks.comparisonAssets()
                )
        );
    }

    @Transactional(readOnly = true)
    public List<FundMonitoringResponse.TechnicalIndicatorResponse> computeMetricsForWeights(
            String actorUsername,
            UUID fundPublicId,
            Map<String, BigDecimal> weightsByAssetCode
    ) {
        User actor = requireActor(actorUsername);
        FundDraft fund = fundDraftRepository
                .findByPublicIdAndStatus(fundPublicId, FundDraftStatus.COMPLETED)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_NOT_FOUND));
        accessPolicy.assertCanView(fund, actor.getId());

        List<Asset> assets = assetRepository.findAllByAssetCodeIn(
                new ArrayList<>(weightsByAssetCode.keySet())
        );
        assertAllAssetsFound(assets, weightsByAssetCode.size());

        Map<String, Asset> assetsByCode = assets.stream()
                .collect(Collectors.toMap(Asset::getAssetCode, asset -> asset));

        BigDecimal totalWeight = weightsByAssetCode.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        LocalDate now = financialTime.currentDate();
        LocalDate historyStart = now.minusYears(1).minusDays(ANNUAL_HISTORY_LOOKBACK_BUFFER_DAYS);

        List<FundPosition> syntheticPositions = weightsByAssetCode.entrySet().stream()
                .map(entry -> FundPosition.builder()
                        .assetId(assetsByCode.get(entry.getKey()).getId())
                        .weight(
                                entry.getValue()
                                        .multiply(new BigDecimal("100"))
                                        .divide(totalWeight, 6, RoundingMode.HALF_UP)
                        )
                        .build())
                .toList();

        Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValuesByAsset =
                valuationProviderRegistry.loadUnitValues(assets, historyStart, now);
        FundValuationResult valuation = valuationCalculator.calculate(
                fund,
                syntheticPositions,
                assets,
                unitValuesByAsset,
                historyStart
        );

        FundValuationPoint latest = valuation.latestPoint();
        BenchmarkSnapshot benchmarks = benchmarkService.load(latest.date());
        BigDecimal annualRiskFreeRate = riskFreeRateProvider.annualRate(latest.date());

        return metricCalculator.technicalIndicators(
                valuation.points(),
                benchmarks.benchmarkValues(),
                annualRiskFreeRate,
                BigDecimal.ZERO
        );
    }

    private FundMonitoringCalculation calculateFund(
            FundDraft fund,
            LocalDate today
    ) {
        FundPortfolio workingPortfolio = requireWorkingPortfolio(fund);
        List<FundPosition> portfolioPositions = fundPositionRepository
                .findAllByFundPortfolioIdOrderByWeightDesc(workingPortfolio.getId());
        LocalDate historyStart = today.minusYears(1)
                .minusDays(ANNUAL_HISTORY_LOOKBACK_BUFFER_DAYS);
        List<FundRebalanceSnapshot> snapshots = relevantSnapshots(
                fundRebalanceService.loadSnapshots(fund, today.atTime(LocalTime.MAX)),
                historyStart
        );
        List<Long> assetIds = portfolioPositions.stream()
                .map(FundPosition::getAssetId)
                .distinct()
                .collect(Collectors.toCollection(ArrayList::new));
        snapshots.stream()
                .flatMap(snapshot -> snapshot.positions().stream())
                .map(FundRebalanceSnapshot.Position::assetId)
                .filter(assetId -> !assetIds.contains(assetId))
                .forEach(assetIds::add);
        List<Asset> assets = assetRepository.findAllById(assetIds);
        assertAllAssetsFound(assets, assetIds.size());

        Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValuesByAsset =
                valuationProviderRegistry.loadUnitValues(
                        assets,
                        historyStart,
                        today
                );
        FundValuationResult trackingValuation;
        if (snapshots.isEmpty()) {
            trackingValuation = valuationCalculator.calculateAroundInception(
                    fund,
                    portfolioPositions,
                    assets,
                    unitValuesByAsset,
                    historyStart
            );
        } else {
            trackingValuation = valuationCalculator.calculateWithRebalances(
                    fund,
                    snapshots,
                    assets,
                    unitValuesByAsset,
                    historyStart
            );
        }
        FundValuationResult backtestValuation = valuationCalculator.calculate(
                fund,
                portfolioPositions,
                assets,
                unitValuesByAsset,
                historyStart
        );
        return new FundMonitoringCalculation(trackingValuation, backtestValuation, assets);
    }

    private List<FundRebalanceSnapshot> relevantSnapshots(
            List<FundRebalanceSnapshot> snapshots,
            LocalDate historyStart
    ) {
        if (snapshots.isEmpty()) {
            return snapshots;
        }

        List<FundRebalanceSnapshot> relevant = new ArrayList<>();
        snapshots.stream()
                .filter(snapshot -> snapshot.effectiveAt().toLocalDate().isBefore(historyStart))
                .reduce((first, second) -> second)
                .ifPresent(relevant::add);
        snapshots.stream()
                .filter(snapshot -> !snapshot.effectiveAt().toLocalDate().isBefore(historyStart))
                .forEach(relevant::add);
        return List.copyOf(relevant);
    }

    @Transactional(readOnly = true)
    public List<FundPositionResponse> getCurrentPositions(
            String actorUsername,
            UUID fundPublicId
    ) {
        User actor = requireActor(actorUsername);
        FundDraft fund = fundDraftRepository
                .findByPublicIdAndStatus(fundPublicId, FundDraftStatus.COMPLETED)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_NOT_FOUND));
        accessPolicy.assertCanView(fund, actor.getId());

        return workingPositions(fund);
    }

    private List<FundPositionResponse> workingPositions(FundDraft fund) {
        FundPortfolio workingPortfolio = requireWorkingPortfolio(fund);
        List<FundPosition> portfolioPositions = fundPositionRepository
                .findAllByFundPortfolioIdOrderByWeightDesc(workingPortfolio.getId());
        List<Long> assetIds = portfolioPositions.stream()
                .map(FundPosition::getAssetId)
                .toList();
        List<Asset> assets = assetRepository.findAllById(assetIds);
        Map<Long, AssetMonitoringProfile> profilesByAssetId =
                classificationProviderRegistry.loadProfiles(assets);

        return portfolioPositions.stream()
                .map(position -> {
                    AssetMonitoringProfile profile = requireProfile(
                            profilesByAssetId,
                            position.getAssetId()
                    );
                    return new FundPositionResponse(
                            profile.assetId().toString(),
                            profile.symbol(),
                            profile.displayName(),
                            profile.allocationGroupName(),
                            position.getWeight()
                    );
                })
                .toList();
    }

    private FundPortfolio requireWorkingPortfolio(FundDraft fund) {
        return fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(
                        fund.getId(),
                        PortfolioType.WORKING
                )
                .orElseThrow(() -> new BaseException(
                        ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE
                ));
    }

    private List<FundComparisonAssetResponse> comparisonAssets(
            FundDraft selectedFund,
            FundValuationResult selectedValuation,
            Long actorUserId,
            LocalDate today,
            List<FundComparisonAssetResponse> similarFundAssets,
            List<FundComparisonAssetResponse> benchmarkAssets
    ) {
        List<FundDraft> visibleFunds = fundDraftRepository
                .findAllByStatusAndCreatedByUserIdOrderByCreatedAtDescIdDesc(
                        FundDraftStatus.COMPLETED,
                        actorUserId
                );
        List<FundComparisonAssetResponse> assets = new ArrayList<>();
        assets.add(comparisonAsset(selectedFund, selectedValuation, 0));
        assets.addAll(benchmarkAssets);

        for (FundDraft fund : visibleFunds) {
            if (fund.getPublicId().equals(selectedFund.getPublicId())) {
                continue;
            }

            FundValuationResult valuation = null;
            try {
                valuation = calculateBacktest(fund, today);
            } catch (BaseException exception) {
                if (exception.getErrorCode()
                        != ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE) {
                    throw exception;
                }
                log.warn(
                        "Comparison returns are unavailable for fund {}",
                        fund.getPublicId()
                );
            }
            assets.add(comparisonAsset(fund, valuation, assets.size()));
        }

        assets.addAll(similarFundAssets);

        return List.copyOf(assets);
    }

    private FundValuationResult calculateBacktest(
            FundDraft fund,
            LocalDate today
    ) {
        FundPortfolio workingPortfolio = requireWorkingPortfolio(fund);
        List<FundPosition> positions = fundPositionRepository
                .findAllByFundPortfolioIdOrderByWeightDesc(workingPortfolio.getId());
        List<Long> assetIds = positions.stream()
                .map(FundPosition::getAssetId)
                .distinct()
                .toList();
        List<Asset> assets = assetRepository.findAllById(assetIds);
        assertAllAssetsFound(assets, assetIds.size());

        LocalDate historyStart = today.minusYears(1)
                .minusDays(ANNUAL_HISTORY_LOOKBACK_BUFFER_DAYS);
        Map<Long, NavigableMap<LocalDate, BigDecimal>> valuesByAsset =
                valuationProviderRegistry.loadUnitValues(assets, historyStart, today);
        return valuationCalculator.calculate(
                fund,
                positions,
                assets,
                valuesByAsset,
                historyStart
        );
    }

    private FundComparisonAssetResponse comparisonAsset(
            FundDraft fund,
            FundValuationResult valuation,
            int colorIndex
    ) {
        LocalDate asOfDate = valuation == null
                ? financialTime.currentDate()
                : valuation.latestPoint().date();
        Map<String, BigDecimal> returns = metricCalculator.comparisonReturns(
                valuation == null ? List.of() : valuation.points(),
                asOfDate
        );

        return new FundComparisonAssetResponse(
                fund.getPublicId().toString(),
                comparisonCode(fund.getName()),
                fund.getName(),
                COMPARISON_COLORS.get(colorIndex % COMPARISON_COLORS.size()),
                true,
                returns
        );
    }

    private String comparisonCode(String fundName) {
        String normalized = fundName == null ? "FON" : fundName.trim();
        if (normalized.isEmpty()) {
            return "FON";
        }
        return normalized.substring(0, Math.min(5, normalized.length()))
                .toUpperCase(Locale.forLanguageTag("tr-TR"));
    }

    private List<FundPositionResponse> positions(
            FundValuationResult valuation,
            Map<Long, AssetMonitoringProfile> profilesByAssetId
    ) {
        return valuation.positions().stream()
                .map(valued -> {
                    AssetMonitoringProfile profile = requireProfile(
                            profilesByAssetId,
                            valued.asset().getId()
                    );

                    return new FundPositionResponse(
                            profile.assetId().toString(),
                            profile.symbol(),
                            profile.displayName(),
                            profile.allocationGroupName(),
                            valued.currentWeightPercentage()
                    );
                })
                .toList();
    }

    private List<SectorAllocationResponse> sectors(
            FundValuationResult valuation,
            Map<Long, AssetMonitoringProfile> profilesByAssetId
    ) {
        Map<SectorKey, BigDecimal> weightsBySector = new HashMap<>();

        for (ValuedFundPosition valued : valuation.positions()) {
            AssetMonitoringProfile profile = requireProfile(
                    profilesByAssetId,
                    valued.asset().getId()
            );
            SectorKey key = new SectorKey(
                    profile.allocationGroupId(),
                    profile.allocationGroupName()
            );
            weightsBySector.merge(
                    key,
                    valued.currentWeightPercentage(),
                    BigDecimal::add
            );
        }

        return weightsBySector.entrySet().stream()
                .map(entry -> new SectorAllocationResponse(
                        entry.getKey().id(),
                        entry.getKey().name(),
                        entry.getValue().setScale(4, RoundingMode.HALF_UP)
                ))
                .sorted(Comparator.comparing(
                        SectorAllocationResponse::weightPercentage,
                        Comparator.reverseOrder()
                ))
                .toList();
    }

    private Map<String, List<PricePointResponse>> priceHistory(
            List<FundValuationPoint> points,
            LocalDate asOfDate
    ) {
        Map<String, List<PricePointResponse>> history = new LinkedHashMap<>();
        history.put("1W", pointsSince(points, asOfDate.minusWeeks(1)));
        history.put("1M", pointsSince(points, asOfDate.minusMonths(1)));
        history.put("3M", pointsSince(points, asOfDate.minusMonths(3)));
        history.put("6M", pointsSince(points, asOfDate.minusMonths(6)));
        history.put("1Y", pointsSince(points, asOfDate.minusYears(1)));
        return history;
    }

    private Map<String, List<PricePointResponse>> normalizedBacktestHistory(
            List<FundValuationPoint> points,
            LocalDate asOfDate
    ) {
        Map<String, List<PricePointResponse>> history = new LinkedHashMap<>();
        history.put("1W", normalizedPointsSince(points, asOfDate.minusWeeks(1)));
        history.put("1M", normalizedPointsSince(points, asOfDate.minusMonths(1)));
        history.put("3M", normalizedPointsSince(points, asOfDate.minusMonths(3)));
        history.put("6M", normalizedPointsSince(points, asOfDate.minusMonths(6)));
        history.put("1Y", normalizedPointsSince(points, asOfDate.minusYears(1)));
        return history;
    }

    private List<PricePointResponse> normalizedPointsSince(
            List<FundValuationPoint> points,
            LocalDate startDate
    ) {
        List<FundValuationPoint> visiblePoints = valuationPointsSince(points, startDate);
        if (visiblePoints.isEmpty()) {
            return List.of();
        }
        FundValuationPoint base = visiblePoints.getFirst();
        return visiblePoints.stream()
                .map(point -> new PricePointResponse(
                        point.date(),
                        normalizedBacktestValue(base, point)
                ))
                .toList();
    }

    private BigDecimal normalizedBacktestPeriodValue(
            List<FundValuationPoint> points
    ) {
        if (points.isEmpty()) {
            throw new BaseException(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
        }
        return normalizedBacktestValue(points.getFirst(), points.getLast());
    }

    private FundValuationPoint latestValuationPoint(
            List<FundValuationPoint> points
    ) {
        if (points.isEmpty()) {
            throw new BaseException(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
        }
        return points.getLast();
    }

    private List<FundValuationPoint> valuationPointsSince(
            List<FundValuationPoint> points,
            LocalDate startDate
    ) {
        return points.stream()
                .filter(point -> !point.date().isBefore(startDate))
                .toList();
    }

    private BigDecimal normalizedBacktestValue(
            FundValuationPoint base,
            FundValuationPoint point
    ) {
        if (base.sharePrice() == null
                || base.sharePrice().signum() <= 0
                || point.sharePrice() == null) {
            throw new BaseException(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
        }
        return point.sharePrice().divide(
                base.sharePrice(),
                8,
                RoundingMode.HALF_UP
        );
    }

    private List<PricePointResponse> pointsSince(
            List<FundValuationPoint> points,
            LocalDate startDate
    ) {
        return points.stream()
                .filter(point -> !point.date().isBefore(startDate))
                .map(point -> new PricePointResponse(point.date(), point.sharePrice()))
                .toList();
    }

    private void assertAllAssetsFound(List<Asset> assets, int expectedAssetCount) {
        if (assets.size() != expectedAssetCount) {
            throw new BaseException(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
        }
    }

    private User requireActor(String actorUsername) {
        return userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
    }

    private AssetMonitoringProfile requireProfile(
            Map<Long, AssetMonitoringProfile> profilesByAssetId,
            Long assetId
    ) {
        AssetMonitoringProfile profile = profilesByAssetId.get(assetId);
        if (profile == null) {
            throw new BaseException(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
        }
        return profile;
    }

    private record SectorKey(String id, String name) {
    }

    private record FundMonitoringCalculation(
            FundValuationResult trackingValuation,
            FundValuationResult backtestValuation,
            List<Asset> assets
    ) {
    }

}
