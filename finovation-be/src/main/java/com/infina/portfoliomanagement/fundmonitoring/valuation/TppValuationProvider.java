package com.infina.portfoliomanagement.fundmonitoring.valuation;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.marketdata.entity.TppRate;
import com.infina.portfoliomanagement.marketdata.repository.TppRateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

@Component
@RequiredArgsConstructor
public class TppValuationProvider implements AssetValuationProvider {

    private static final int UNIT_VALUE_SCALE = 16;
    private static final BigDecimal RATE_DAY_DIVISOR = new BigDecimal("36500");

    private final TppRateRepository tppRateRepository;

    @Override
    public AssetType supportedType() {
        return AssetType.TPP;
    }

    @Override
    public Map<Long, NavigableMap<LocalDate, BigDecimal>> loadUnitValues(
            List<Long> assetIds,
            LocalDate from,
            LocalDate to
    ) {
        List<TppRate> rates = tppRateRepository
                .findAllByAssetIdInAndDataDateBetweenOrderByDataDateAsc(
                        assetIds,
                        from,
                        to
                );
        return toUnitValues(rates);
    }

    Map<Long, NavigableMap<LocalDate, BigDecimal>> toUnitValues(
            List<TppRate> rates
    ) {
        Map<Long, NavigableMap<LocalDate, BigDecimal>> ratesByAsset =
                groupRates(rates);
        Map<Long, NavigableMap<LocalDate, BigDecimal>> valuesByAsset =
                new HashMap<>();

        for (Map.Entry<Long, NavigableMap<LocalDate, BigDecimal>> assetRates
                : ratesByAsset.entrySet()) {
            valuesByAsset.put(
                    assetRates.getKey(),
                    accrueUnitValues(assetRates.getValue())
            );
        }

        return valuesByAsset;
    }

    private Map<Long, NavigableMap<LocalDate, BigDecimal>> groupRates(
            List<TppRate> rates
    ) {
        Map<Long, NavigableMap<LocalDate, BigDecimal>> ratesByAsset =
                new HashMap<>();
        for (TppRate rate : rates) {
            if (rate.getWeightedAverageRate() == null) {
                throw unavailable();
            }
            ratesByAsset
                    .computeIfAbsent(rate.getAsset().getId(), ignored -> new TreeMap<>())
                    .put(rate.getDataDate(), rate.getWeightedAverageRate());
        }
        return ratesByAsset;
    }

    private NavigableMap<LocalDate, BigDecimal> accrueUnitValues(
            NavigableMap<LocalDate, BigDecimal> rates
    ) {
        NavigableMap<LocalDate, BigDecimal> values = new TreeMap<>();
        LocalDate previousDate = null;
        BigDecimal previousRate = null;
        BigDecimal unitValue = BigDecimal.ONE.setScale(UNIT_VALUE_SCALE);

        for (Map.Entry<LocalDate, BigDecimal> observation : rates.entrySet()) {
            if (previousDate != null) {
                long elapsedDays = ChronoUnit.DAYS.between(
                        previousDate,
                        observation.getKey()
                );
                BigDecimal growth = previousRate
                        .multiply(BigDecimal.valueOf(elapsedDays))
                        .divide(
                                RATE_DAY_DIVISOR,
                                UNIT_VALUE_SCALE,
                                RoundingMode.HALF_UP
                        );
                unitValue = unitValue
                        .multiply(BigDecimal.ONE.add(growth))
                        .setScale(UNIT_VALUE_SCALE, RoundingMode.HALF_UP);
            }
            values.put(observation.getKey(), unitValue);
            previousDate = observation.getKey();
            previousRate = observation.getValue();
        }

        return values;
    }

    private BaseException unavailable() {
        return new BaseException(ErrorCode.FUND_MONITORING_DATA_UNAVAILABLE);
    }
}
