package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.fund.repository.FundPositionRepository;
import com.infina.portfoliomanagement.fundmonitoring.classification.AssetClassificationProviderRegistry;
import com.infina.portfoliomanagement.fundmonitoring.config.FundMonitoringProperties;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundPositionResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.PricePointResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.SectorAllocationResponse;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundSummaryResponse;
import com.infina.portfoliomanagement.fundmonitoring.model.AssetMonitoringProfile;
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
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class FundMonitoringService {

    private static final BigDecimal ZERO_PERCENT = BigDecimal.ZERO.setScale(4);

    private final FundDraftRepository fundDraftRepository;
    private final FundPortfolioRepository fundPortfolioRepository;
    private final FundPositionRepository fundPositionRepository;
    private final AssetRepository assetRepository;
    private final UserRepository userRepository;
    private final FundMonitoringAccessPolicy accessPolicy;
    private final AssetValuationProviderRegistry valuationProviderRegistry;
    private final AssetClassificationProviderRegistry classificationProviderRegistry;
    private final FundValuationCalculator valuationCalculator;
    private final FundMetricCalculator metricCalculator;
    private final FundMonitoringProperties properties;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<FundSummaryResponse> listFunds(String actorUsername) {
        User actor = requireActor(actorUsername);

        return fundDraftRepository
                .findAllByStatusAndCreatedByUserIdOrderByCreatedAtDescIdDesc(
                        FundDraftStatus.COMPLETED,
                        actor.getId()
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

        FundPortfolio selectedPortfolio = fundPortfolioRepository
                .findByFundDraftIdAndSelectedTrue(fund.getId())
                .orElseThrow(() -> new BaseException(
                        ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE
                ));
        List<FundPosition> portfolioPositions = fundPositionRepository
                .findAllByFundPortfolioIdOrderByWeightDesc(selectedPortfolio.getId());
        List<Long> assetIds = portfolioPositions.stream()
                .map(FundPosition::getAssetId)
                .toList();
        List<Asset> assets = assetRepository.findAllById(assetIds);
        assertAllAssetsFound(assets, new HashSet<>(assetIds).size());
        LocalDate inceptionDate = fund.getCreatedAt().toLocalDate();
        LocalDate today = LocalDate.now(clock);

        Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValuesByAsset =
                valuationProviderRegistry.loadUnitValues(
                        assets,
                        inceptionDate,
                        today
                );
        FundValuationResult valuation =
                valuationCalculator.calculate(
                        fund,
                        portfolioPositions,
                        assets,
                        unitValuesByAsset
                );

        Map<Long, AssetMonitoringProfile> profilesByAssetId =
                classificationProviderRegistry.loadProfiles(assets);

        List<FundPositionResponse> positions = positions(valuation, profilesByAssetId);
        List<SectorAllocationResponse> sectors = sectors(valuation, profilesByAssetId);

        BigDecimal sectorConcentration = sectors.stream()
                .map(SectorAllocationResponse::weightPercentage)
                .max(BigDecimal::compareTo)
                .orElse(ZERO_PERCENT);
        BigDecimal liquidityRatio = valuation.positions().stream()
                .filter(position -> requireProfile(
                        profilesByAssetId,
                        position.asset().getId()
                ).liquid())
                .map(ValuedFundPosition::currentWeightPercentage)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(4, RoundingMode.HALF_UP);
        List<FundValuationPoint> points = valuation.points();
        FundValuationPoint latest = valuation.latestPoint();

        log.info(
                "Fund monitoring snapshot calculated for fund {} at {} with {} valuation point(s)",
                fund.getPublicId(),
                latest.date(),
                points.size()
        );

        return new FundMonitoringResponse(
                FundSummaryResponse.from(fund),
                latest.date(),
                fund.getCurrencyCode(),
                properties.fixedOutstandingShares(),
                latest.sharePrice(),
                metricCalculator.dailyChange(points),
                priceHistory(points, latest.date()),
                metricCalculator.technicalIndicators(
                        points,
                        sectorConcentration,
                        liquidityRatio
                ),
                metricCalculator.periodReturns(points, latest.date()),
                positions,
                sectors
        );
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
}
