package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fundmonitoring.config.FundMonitoringProperties;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationPoint;
import com.infina.portfoliomanagement.fundmonitoring.model.FundValuationResult;
import com.infina.portfoliomanagement.fundmonitoring.model.ValuedFundPosition;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class FundValuationCalculator {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final BigDecimal WEIGHT_TOLERANCE = new BigDecimal("0.0001");
    private static final int QUANTITY_SCALE = 12;
    private static final int MONEY_SCALE = 8;

    private final FundMonitoringProperties properties;

    public FundValuationResult calculate(
            FundDraft fund,
            List<FundPosition> positions,
            List<Asset> assets,
            Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValuesByAsset
    ) {
        return calculate(
                fund,
                positions,
                assets,
                unitValuesByAsset,
                fund.getCreatedAt().toLocalDate()
        );
    }

    public FundValuationResult calculate(
            FundDraft fund,
            List<FundPosition> positions,
            List<Asset> assets,
            Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValuesByAsset,
            LocalDate historyStartDate
    ) {
        if (positions.isEmpty()) {
            throw unavailable();
        }

        assertWeightsSumToOneHundred(positions);

        Map<Long, Asset> assetsById = assets.stream()
                .collect(Collectors.toMap(Asset::getId, Function.identity()));
        assertUnitValuesAvailable(assets, unitValuesByAsset);
        SortedSet<LocalDate> commonDates = resolveCommonDates(
                historyStartDate,
                positions,
                unitValuesByAsset
        );
        LocalDate baseDate = commonDates.getFirst();
        Map<Long, BigDecimal> quantities = calculateQuantities(
                fund,
                positions,
                unitValuesByAsset,
                baseDate
        );

        List<FundValuationPoint> points = commonDates.stream()
                .map(date -> calculatePoint(date, positions, unitValuesByAsset, quantities))
                .toList();
        FundValuationPoint latestPoint = points.getLast();
        List<ValuedFundPosition> valuedPositions = positions.stream()
                .map(position -> valuePosition(
                        position,
                        requireAsset(assetsById, position.getAssetId()),
                        unitValuesByAsset,
                        quantities,
                        latestPoint
                ))
                .sorted(Comparator.comparing(
                        ValuedFundPosition::currentWeightPercentage,
                        Comparator.reverseOrder()
                ))
                .toList();

        return new FundValuationResult(points, valuedPositions);
    }

    private void assertWeightsSumToOneHundred(List<FundPosition> positions) {
        BigDecimal total = positions.stream()
                .map(FundPosition::getWeight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (total.subtract(ONE_HUNDRED).abs().compareTo(WEIGHT_TOLERANCE) > 0) {
            throw unavailable();
        }
    }

    private void assertUnitValuesAvailable(
            List<Asset> assets,
            Map<Long, NavigableMap<LocalDate, BigDecimal>> unitValuesByAsset
    ) {
        for (Asset asset : assets) {
            NavigableMap<LocalDate, BigDecimal> values =
                    unitValuesByAsset.get(asset.getId());
            if (values == null || values.isEmpty()) {
                throw unavailable();
            }
        }
    }

    private SortedSet<LocalDate> resolveCommonDates(
            LocalDate inceptionDate,
            List<FundPosition> positions,
            Map<Long, NavigableMap<LocalDate, BigDecimal>> pricesByAsset
    ) {
        SortedSet<LocalDate> commonDates = null;

        for (FundPosition position : positions) {
            NavigableMap<LocalDate, BigDecimal> assetPrices =
                    pricesByAsset.get(position.getAssetId());
            if (assetPrices == null || assetPrices.isEmpty()) {
                throw unavailable();
            }

            if (commonDates == null) {
                commonDates = new TreeSet<>(assetPrices.navigableKeySet());
            } else {
                commonDates.retainAll(assetPrices.navigableKeySet());
            }
        }

        if (commonDates == null) {
            throw unavailable();
        }

        commonDates.removeIf(date -> date.isBefore(inceptionDate));
        if (commonDates.isEmpty()) {
            throw unavailable();
        }

        return commonDates;
    }

    private Map<Long, BigDecimal> calculateQuantities(
            FundDraft fund,
            List<FundPosition> positions,
            Map<Long, NavigableMap<LocalDate, BigDecimal>> pricesByAsset,
            LocalDate baseDate
    ) {
        Map<Long, BigDecimal> quantities = new HashMap<>();

        for (FundPosition position : positions) {
            BigDecimal basePrice = pricesByAsset.get(position.getAssetId()).get(baseDate);
            if (basePrice == null || basePrice.signum() <= 0) {
                throw unavailable();
            }

            BigDecimal allocatedValue = fund.getInitialPortfolioSize()
                    .multiply(position.getWeight())
                    .divide(ONE_HUNDRED, MONEY_SCALE, RoundingMode.HALF_UP);
            quantities.put(
                    position.getAssetId(),
                    allocatedValue.divide(basePrice, QUANTITY_SCALE, RoundingMode.HALF_UP)
            );
        }

        return quantities;
    }

    private FundValuationPoint calculatePoint(
            LocalDate date,
            List<FundPosition> positions,
            Map<Long, NavigableMap<LocalDate, BigDecimal>> pricesByAsset,
            Map<Long, BigDecimal> quantities
    ) {
        BigDecimal nav = positions.stream()
                .map(position -> quantities.get(position.getAssetId())
                        .multiply(pricesByAsset.get(position.getAssetId()).get(date)))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        BigDecimal sharePrice = nav.divide(
                properties.fixedOutstandingShares(),
                MONEY_SCALE,
                RoundingMode.HALF_UP
        );

        return new FundValuationPoint(date, nav, sharePrice);
    }

    private ValuedFundPosition valuePosition(
            FundPosition position,
            Asset asset,
            Map<Long, NavigableMap<LocalDate, BigDecimal>> pricesByAsset,
            Map<Long, BigDecimal> quantities,
            FundValuationPoint latestPoint
    ) {
        BigDecimal quantity = quantities.get(position.getAssetId());
        BigDecimal latestPrice = pricesByAsset.get(position.getAssetId())
                .get(latestPoint.date());
        BigDecimal currentValue = quantity.multiply(latestPrice)
                .setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        BigDecimal currentWeight = currentValue
                .multiply(ONE_HUNDRED)
                .divide(latestPoint.nav(), 6, RoundingMode.HALF_UP);

        return new ValuedFundPosition(
                position,
                asset,
                quantity,
                currentValue,
                currentWeight
        );
    }

    private Asset requireAsset(Map<Long, Asset> assetsById, Long assetId) {
        Asset asset = assetsById.get(assetId);
        if (asset == null) {
            throw unavailable();
        }
        return asset;
    }

    private BaseException unavailable() {
        return new BaseException(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
    }
}
