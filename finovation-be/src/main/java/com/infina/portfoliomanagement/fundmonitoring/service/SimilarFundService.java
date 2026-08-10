package com.infina.portfoliomanagement.fundmonitoring.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fundmonitoring.dto.FundMonitoringResponse.FundComparisonAssetResponse;
import com.infina.portfoliomanagement.fundmonitoring.model.ComparisonPeriod;
import com.infina.portfoliomanagement.marketdata.infina.api.SimilarFundApi;
import com.infina.portfoliomanagement.marketdata.infina.dto.FundProfileRecord;
import com.infina.portfoliomanagement.marketdata.infina.dto.FundProfileRecord.FundBenchmarkRecord;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimilarFundService {

    private static final String FUND_BENCHMARK_TYPE = "Fund";
    private static final Map<FundType, List<String>> PEER_CODES = peerCodes();
    private static final Map<String, ComparisonPeriod> SOURCE_PERIODS = Map.of(
            "P1W", ComparisonPeriod.ONE_WEEK,
            "P1M", ComparisonPeriod.ONE_MONTH,
            "P3M", ComparisonPeriod.THREE_MONTHS,
            "P6M", ComparisonPeriod.SIX_MONTHS,
            "XYTD", ComparisonPeriod.YEAR_TO_DATE,
            "P1Y", ComparisonPeriod.ONE_YEAR,
            "P3Y", ComparisonPeriod.THREE_YEARS,
            "P5Y", ComparisonPeriod.FIVE_YEARS
    );
    private static final List<String> COLORS = List.of(
            "#0f766e",
            "#1d4ed8",
            "#6d28d9",
            "#c2410c",
            "#be123c",
            "#0369a1",
            "#4d7c0f",
            "#a21caf",
            "#b45309",
            "#475569"
    );

    private final SimilarFundApi similarFundApi;

    public List<FundComparisonAssetResponse> comparisonAssets(
            FundType fundType,
            LocalDate asOfDate
    ) {
        List<String> peerCodes = PEER_CODES.getOrDefault(fundType, List.of());
        if (peerCodes.isEmpty()) {
            return List.of();
        }

        try {
            return similarFundApi.fetchComparisons(peerCodes, asOfDate)
                    .map(profile -> comparisonAssets(profile, peerCodes))
                    .orElseGet(List::of);
        } catch (BaseException | RestClientException
                 | CallNotPermittedException | RequestNotPermitted exception) {
            log.warn(
                    "Similar fund comparison data is unavailable: {}",
                    exception.getClass().getSimpleName()
            );
            return List.of();
        }
    }

    private List<FundComparisonAssetResponse> comparisonAssets(
            FundProfileRecord profile,
            List<String> peerCodes
    ) {
        if (profile.periods() == null || profile.benchmarks() == null) {
            return List.of();
        }

        Map<String, FundBenchmarkRecord> benchmarksByCode = new HashMap<>();
        for (FundBenchmarkRecord benchmark : profile.benchmarks()) {
            if (benchmark.code() != null
                    && FUND_BENCHMARK_TYPE.equalsIgnoreCase(benchmark.type())) {
                benchmarksByCode.put(benchmark.code(), benchmark);
            }
        }

        List<FundComparisonAssetResponse> assets = new ArrayList<>();
        for (String peerCode : peerCodes) {
            FundBenchmarkRecord benchmark = benchmarksByCode.get(peerCode);
            if (benchmark != null) {
                assets.add(comparisonAsset(
                        benchmark,
                        profile.periods(),
                        assets.size()
                ));
            }
        }
        return List.copyOf(assets);
    }

    private FundComparisonAssetResponse comparisonAsset(
            FundBenchmarkRecord benchmark,
            List<String> periods,
            int colorIndex
    ) {
        return new FundComparisonAssetResponse(
                "similar-fund-" + benchmark.code().toLowerCase(Locale.ROOT),
                benchmark.code(),
                benchmark.description(),
                COLORS.get(colorIndex % COLORS.size()),
                true,
                returns(periods, benchmark.returns())
        );
    }

    private Map<String, BigDecimal> returns(
            List<String> sourcePeriods,
            List<BigDecimal> sourceReturns
    ) {
        Map<ComparisonPeriod, BigDecimal> valuesByPeriod =
                new EnumMap<>(ComparisonPeriod.class);
        if (sourceReturns != null) {
            int valueCount = Math.min(sourcePeriods.size(), sourceReturns.size());
            for (int index = 0; index < valueCount; index++) {
                ComparisonPeriod period = SOURCE_PERIODS.get(
                        sourcePeriods.get(index)
                );
                if (period != null) {
                    valuesByPeriod.put(period, sourceReturns.get(index));
                }
            }
        }

        Map<String, BigDecimal> returns = new LinkedHashMap<>();
        for (ComparisonPeriod period : ComparisonPeriod.values()) {
            returns.put(period.code(), valuesByPeriod.get(period));
        }
        return Collections.unmodifiableMap(returns);
    }

    private static Map<FundType, List<String>> peerCodes() {
        Map<FundType, List<String>> codes = new EnumMap<>(FundType.class);
        codes.put(
                FundType.EQUITY_INTENSIVE,
                List.of(
                        "MAC",
                        "IIH",
                        "TI2",
                        "YAS",
                        "AK3",
                        "GHS",
                        "GMR",
                        "HVS",
                        "TKF",
                        "TZD"
                )
        );
        return Map.copyOf(codes);
    }
}
