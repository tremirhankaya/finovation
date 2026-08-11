package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fundmonitoring.entity.FundRebalance;
import com.infina.portfoliomanagement.fundmonitoring.entity.FundRebalancePosition;
import com.infina.portfoliomanagement.fundmonitoring.enums.FundRebalanceType;
import com.infina.portfoliomanagement.fundmonitoring.model.FundRebalanceSnapshot;
import com.infina.portfoliomanagement.fundmonitoring.repository.FundRebalanceRepository;
import com.infina.portfoliomanagement.fundmonitoring.valuation.AssetValuationProviderRegistry;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FundRebalanceService {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final int QUANTITY_SCALE = 12;
    private static final int MONEY_SCALE = 8;

    private final FundRebalanceRepository fundRebalanceRepository;
    private final AssetRepository assetRepository;
    private final AssetValuationProviderRegistry valuationProviderRegistry;

    @Transactional(readOnly = true)
    public List<FundRebalanceSnapshot> loadSnapshots(
            FundDraft fund,
            LocalDateTime through
    ) {
        return fundRebalanceRepository
                .findAllByFundDraft_IdAndEffectiveAtLessThanEqualOrderByEffectiveAtAscIdAsc(
                        fund.getId(),
                        through
                ).stream()
                .map(this::toSnapshot)
                .toList();
    }

    @Transactional
    public void recordOptimization(
            FundDraft fund,
            List<FundPosition> currentPositions,
            Map<Long, BigDecimal> targetWeightsByAssetId,
            Long optimizationRequestId,
            LocalDateTime effectiveAt
    ) {
        if (fundRebalanceRepository.existsByOptimizationRequestId(optimizationRequestId)) {
            return;
        }
        if (currentPositions.isEmpty() || targetWeightsByAssetId.isEmpty()) {
            throw unavailable();
        }

        Set<Long> assetIds = currentPositions.stream()
                .map(FundPosition::getAssetId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        assetIds.addAll(targetWeightsByAssetId.keySet());
        Map<Long, Asset> assetsById = assetRepository.findAllById(assetIds).stream()
                .collect(Collectors.toMap(Asset::getId, Function.identity()));
        if (assetsById.size() != assetIds.size()) {
            throw unavailable();
        }

        LocalDate inceptionDate = fund.getCreatedAt().toLocalDate();
        LocalDate effectiveDate = effectiveAt.toLocalDate();
        Map<Long, NavigableMap<LocalDate, BigDecimal>> valuesByAsset =
                valuationProviderRegistry.loadUnitValues(
                        new ArrayList<>(assetsById.values()),
                        inceptionDate,
                        effectiveDate
                );

        if (!fundRebalanceRepository.existsByFundDraft_IdAndRebalanceType(
                fund.getId(),
                FundRebalanceType.CREATION
        )) {
            fundRebalanceRepository.saveAndFlush(creationSnapshot(
                    fund,
                    currentPositions,
                    assetsById,
                    valuesByAsset
            ));
        }

        FundRebalanceSnapshot activeSnapshot = loadSnapshots(fund, effectiveAt).stream()
                .max(Comparator.comparing(FundRebalanceSnapshot::effectiveAt)
                        .thenComparing(FundRebalanceSnapshot::id))
                .orElseThrow(this::unavailable);

        Set<Long> valuationAssetIds = activeSnapshot.positions().stream()
                .map(FundRebalanceSnapshot.Position::assetId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        valuationAssetIds.addAll(targetWeightsByAssetId.keySet());
        LocalDate valuationDate = latestCommonDate(
                valuationAssetIds,
                valuesByAsset,
                effectiveDate
        );
        BigDecimal currentNav = activeSnapshot.positions().stream()
                .map(position -> position.quantity().multiply(
                        requireValue(valuesByAsset, position.assetId(), valuationDate)
                ))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(MONEY_SCALE, RoundingMode.HALF_UP);
        if (currentNav.signum() <= 0) {
            throw unavailable();
        }

        FundRebalance optimization = FundRebalance.builder()
                .fundDraft(fund)
                .rebalanceType(FundRebalanceType.OPTIMIZATION)
                .effectiveAt(effectiveAt)
                .optimizationRequestId(optimizationRequestId)
                .navAtRebalance(currentNav)
                .createdAt(effectiveAt)
                .build();
        targetWeightsByAssetId.forEach((assetId, targetWeight) -> {
            if (targetWeight.signum() <= 0) {
                return;
            }
            BigDecimal executionPrice = requireValue(valuesByAsset, assetId, valuationDate);
            BigDecimal allocatedValue = currentNav.multiply(targetWeight)
                    .divide(ONE_HUNDRED, MONEY_SCALE, RoundingMode.HALF_UP);
            optimization.addPosition(FundRebalancePosition.builder()
                    .asset(assetsById.get(assetId))
                    .targetWeight(targetWeight)
                    .quantity(allocatedValue.divide(
                            executionPrice,
                            QUANTITY_SCALE,
                            RoundingMode.HALF_UP
                    ))
                    .executionPrice(executionPrice)
                    .build());
        });
        fundRebalanceRepository.save(optimization);

        log.info(
                "Optimization valuation snapshot recorded for fund {} and request {} at {}",
                fund.getPublicId(),
                optimizationRequestId,
                effectiveAt
        );
    }

    private FundRebalance creationSnapshot(
            FundDraft fund,
            List<FundPosition> positions,
            Map<Long, Asset> assetsById,
            Map<Long, NavigableMap<LocalDate, BigDecimal>> valuesByAsset
    ) {
        LocalDate inceptionDate = fund.getCreatedAt().toLocalDate();
        FundRebalance creation = FundRebalance.builder()
                .fundDraft(fund)
                .rebalanceType(FundRebalanceType.CREATION)
                .effectiveAt(fund.getCreatedAt())
                .navAtRebalance(fund.getInitialPortfolioSize())
                .createdAt(fund.getCreatedAt())
                .build();
        for (FundPosition position : positions) {
            if (position.getWeight().signum() <= 0) {
                continue;
            }
            BigDecimal executionPrice = requireValue(
                    valuesByAsset,
                    position.getAssetId(),
                    inceptionDate
            );
            BigDecimal allocatedValue = fund.getInitialPortfolioSize()
                    .multiply(position.getWeight())
                    .divide(ONE_HUNDRED, MONEY_SCALE, RoundingMode.HALF_UP);
            creation.addPosition(FundRebalancePosition.builder()
                    .asset(assetsById.get(position.getAssetId()))
                    .targetWeight(position.getWeight())
                    .quantity(allocatedValue.divide(
                            executionPrice,
                            QUANTITY_SCALE,
                            RoundingMode.HALF_UP
                    ))
                    .executionPrice(executionPrice)
                    .build());
        }
        return creation;
    }

    private LocalDate latestCommonDate(
            Set<Long> assetIds,
            Map<Long, NavigableMap<LocalDate, BigDecimal>> valuesByAsset,
            LocalDate through
    ) {
        SortedSet<LocalDate> commonDates = null;
        for (Long assetId : assetIds) {
            NavigableMap<LocalDate, BigDecimal> values = valuesByAsset.get(assetId);
            if (values == null || values.isEmpty()) {
                throw unavailable();
            }
            NavigableSet<LocalDate> dates = values.headMap(through, true).navigableKeySet();
            if (commonDates == null) {
                commonDates = new TreeSet<>(dates);
            } else {
                commonDates.retainAll(dates);
            }
        }
        if (commonDates == null || commonDates.isEmpty()) {
            throw unavailable();
        }
        return commonDates.getLast();
    }

    private BigDecimal requireValue(
            Map<Long, NavigableMap<LocalDate, BigDecimal>> valuesByAsset,
            Long assetId,
            LocalDate date
    ) {
        NavigableMap<LocalDate, BigDecimal> values = valuesByAsset.get(assetId);
        BigDecimal value = values == null ? null : values.get(date);
        if (value == null || value.signum() <= 0) {
            throw unavailable();
        }
        return value;
    }

    private FundRebalanceSnapshot toSnapshot(FundRebalance rebalance) {
        return new FundRebalanceSnapshot(
                rebalance.getId(),
                rebalance.getEffectiveAt(),
                rebalance.getPositions().stream()
                        .map(position -> new FundRebalanceSnapshot.Position(
                                position.getAsset().getId(),
                                position.getTargetWeight(),
                                position.getQuantity()
                        ))
                        .toList()
        );
    }

    private BaseException unavailable() {
        return new BaseException(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
    }
}
