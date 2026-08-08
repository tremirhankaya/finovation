package com.infina.portfoliomanagement.fund.mock;

import com.infina.portfoliomanagement.fund.service.analysis.FundModelClient;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAssetDto;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelProposalDto;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;


@Slf4j
@Component
@RequiredArgsConstructor
public class MockFundModelClient implements FundModelClient {

    private static final double TOTAL_WEIGHT_PCT = 100.0;
    private static final double MIN_STOCK_WEIGHT_PCT = 3.0;
    private static final double MAX_STOCK_WEIGHT_PCT = 10.0;
    private static final double ABOVE_5_PCT_THRESHOLD = 5.0;
    private static final double ABOVE_5_PCT_SUM_MAX = 40.0;

    private static final List<String> SAMPLE_NOTES = List.of(
            "Yüksek momentum",
            "Likidite desteği",
            "Sektör çeşitlendirme",
            "Stabil nakit akışı",
            "Düşük volatilite",
            "Temettü profili",
            "Büyüme potansiyeli"
    );

    private static final List<String> PROPOSAL_LABELS = List.of(
            "test1",
            "test2",
            "test3"
    );

    private final AssetRepository assetRepository;
    private final EquityDetailRepository equityDetailRepository;

    @Override
    public FundModelAnalysisResponse analyze(FundModelAnalysisRequest request) {
        log.info(
                "Mock fund model analysis started (minStock={}, maxStock={}, tpp={}–{})",
                request.minStockCount(),
                request.maxStockCount(),
                request.tppMinWeight(),
                request.tppMaxWeight()
        );

        try {
            Thread.sleep(2500);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }

        List<String> equityCodes = loadEquityUniverseCodes(request);
        String tppCode = loadTppCode();
        Map<String, String> sectorByCode = loadSectorNamesByCode();

        int proposalCount = 2;
        List<FundModelProposalDto> proposals = new ArrayList<>(proposalCount);
        for (int rank = 1; rank <= proposalCount; rank++) {
            proposals.add(new FundModelProposalDto(
                    rank,
                    PROPOSAL_LABELS.get((rank - 1) % PROPOSAL_LABELS.size()),
                    buildRuleCompliantPortfolio(request, equityCodes, tppCode, sectorByCode)
            ));
        }

        return new FundModelAnalysisResponse(proposals);
    }

    private List<String> loadEquityUniverseCodes(FundModelAnalysisRequest request) {
        Set<String> excluded = request.excludedAssets() == null
                ? Set.of()
                : new HashSet<>(request.excludedAssets());

        List<String> codes = assetRepository
                .findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                        AssetType.EQUITY
                )
                .stream()
                .map(Asset::getAssetCode)
                .filter(code -> !excluded.contains(code))
                .toList();

        if (codes.isEmpty()) {
            throw new BaseException(ErrorCode.FUND_MODEL_UNIVERSE_EMPTY);
        }
        return codes;
    }

    private String loadTppCode() {
        return assetRepository
                .findAllByAssetTypeAndActiveTrueOrderByAssetCodeAsc(AssetType.TPP)
                .stream()
                .map(Asset::getAssetCode)
                .findFirst()
                .orElse("TPP");
    }

    private List<FundModelAssetDto> buildRuleCompliantPortfolio(
            FundModelAnalysisRequest request,
            List<String> equityCodes,
            String tppCode,
            Map<String, String> sectorByCode
    ) {
        ThreadLocalRandom random = ThreadLocalRandom.current();

        double tppWeight = resolveFixedTppWeight(request);
        double equityBudget = TOTAL_WEIGHT_PCT - tppWeight;

        double requestedSingleStockMax = request.singleStockMaxWeight().doubleValue();
        double singleStockCap = requestedSingleStockMax > 0
                ? Math.min(MAX_STOCK_WEIGHT_PCT, requestedSingleStockMax)
                : MAX_STOCK_WEIGHT_PCT;

        double maxStockWeight = Math.min(singleStockCap, equityBudget);
        double minStockWeight = Math.min(MIN_STOCK_WEIGHT_PCT, maxStockWeight);

        List<String> mandatory = request.mandatoryAssets() == null
                ? List.of()
                : request.mandatoryAssets().stream()
                .filter(equityCodes::contains)
                .distinct()
                .toList();

        int stockCount = pickFeasibleStockCount(
                request.minStockCount(),
                request.maxStockCount(),
                equityCodes.size(),
                equityBudget,
                minStockWeight,
                maxStockWeight,
                random
        );
        stockCount = Math.max(stockCount, mandatory.size());
        stockCount = Math.min(stockCount, equityCodes.size());

        List<Double> stockWeights = allocateStockWeights(
                stockCount,
                equityBudget,
                minStockWeight,
                maxStockWeight,
                random
        );

        List<String> tickers = new ArrayList<>(mandatory);
        List<String> remainder = equityCodes.stream()
                .filter(code -> !mandatory.contains(code))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        Collections.shuffle(remainder, random);
        tickers.addAll(remainder);

        double sectorCap = resolveSectorCap(request);
        Map<String, Double> sectorTotals = new HashMap<>();

        List<FundModelAssetDto> assets = new ArrayList<>(stockCount + 1);
        int cursor = 0;
        for (int i = 0; i < stockCount && cursor < tickers.size(); i++) {
            double weight = stockWeights.get(i);
            int picked = pickTickerWithSectorHeadroom(
                    tickers,
                    cursor,
                    sectorByCode,
                    sectorTotals,
                    weight,
                    sectorCap,
                    mandatory
            );
            if (picked < 0) {
                break;
            }
            String code = tickers.get(picked);
            Collections.swap(tickers, cursor, picked);
            cursor++;

            String sector = sectorByCode.get(code);
            if (sector != null) {
                sectorTotals.merge(sector, weight, Double::sum);
            }

            String note = mandatory.contains(code)
                    ? "Zorunlu hisse"
                    : SAMPLE_NOTES.get(random.nextInt(SAMPLE_NOTES.size()));
            assets.add(new FundModelAssetDto(code, toWeight(weight), note));
        }

        redistributeUnusedBudget(assets, stockWeights, maxStockWeight);

        assets.sort(Comparator.comparing(FundModelAssetDto::weight).reversed());

        assets.add(new FundModelAssetDto(
                tppCode,
                toWeight(tppWeight),
                "Sabit likidite (TPP)"
        ));

        return assets;
    }

    private Map<String, String> loadSectorNamesByCode() {
        List<Asset> assets = assetRepository
                .findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                        AssetType.EQUITY
                );
        if (assets.isEmpty()) {
            return Map.of();
        }

        Map<String, String> sectorByCode = new HashMap<>();
        equityDetailRepository
                .findAllByAssetIdIn(assets.stream().map(Asset::getId).toList())
                .forEach(detail -> {
                    if (detail.getAsset() == null || detail.getSector() == null) {
                        return;
                    }
                    sectorByCode.put(
                            detail.getAsset().getAssetCode(),
                            detail.getSector().getName()
                    );
                });
        return sectorByCode;
    }

    private double resolveSectorCap(FundModelAnalysisRequest request) {
        double requested = request.sectorMaxWeight().doubleValue();
        return requested > 0 ? requested : TOTAL_WEIGHT_PCT;
    }

    private int pickTickerWithSectorHeadroom(
            List<String> tickers,
            int from,
            Map<String, String> sectorByCode,
            Map<String, Double> sectorTotals,
            double weight,
            double sectorCap,
            List<String> mandatory
    ) {
        for (int i = from; i < tickers.size(); i++) {
            String code = tickers.get(i);
            if (mandatory.contains(code)) {
                return i;
            }
            String sector = sectorByCode.get(code);
            if (sector == null) {
                return i;
            }
            double current = sectorTotals.getOrDefault(sector, 0.0);
            if (current + weight <= sectorCap + 1e-9) {
                return i;
            }
        }
        return -1;
    }

    private void redistributeUnusedBudget(
            List<FundModelAssetDto> assets,
            List<Double> plannedWeights,
            double maxStockWeight
    ) {
        if (assets.isEmpty() || assets.size() == plannedWeights.size()) {
            return;
        }
        double planned = plannedWeights.stream().mapToDouble(Double::doubleValue).sum();
        double placed = assets.stream()
                .mapToDouble(asset -> asset.weight().doubleValue())
                .sum();
        double leftover = planned - placed;

        for (int i = 0; i < assets.size() && leftover > 1e-9; i++) {
            FundModelAssetDto asset = assets.get(i);
            double current = asset.weight().doubleValue();
            double headroom = maxStockWeight - current;
            if (headroom <= 1e-9) {
                continue;
            }
            double added = Math.min(headroom, leftover);
            assets.set(i, new FundModelAssetDto(
                    asset.assetCode(),
                    toWeight(current + added),
                    asset.aiNote()
            ));
            leftover -= added;
        }
    }

    private double resolveFixedTppWeight(FundModelAnalysisRequest request) {
        double min = request.tppMinWeight().doubleValue();
        double max = request.tppMaxWeight().doubleValue();
        double mid = (min + max) / 2.0;
        return Math.max(min, Math.min(max, mid));
    }

    private int pickFeasibleStockCount(
            int requestedMin,
            int requestedMax,
            int universeSize,
            double equityBudget,
            double minW,
            double maxW,
            ThreadLocalRandom random
    ) {
        int hardMin = Math.max(1, requestedMin);
        int hardMax = Math.max(hardMin, Math.min(requestedMax, universeSize));

        int feasibleMin = (int) Math.ceil(equityBudget / maxW - 1e-9);
        int feasibleMax = (int) Math.floor(equityBudget / minW + 1e-9);

        int low = Math.max(hardMin, feasibleMin);
        int high = Math.min(hardMax, feasibleMax);
        if (low > high) {
            low = Math.max(1, Math.min(feasibleMin, hardMax));
            high = Math.max(low, Math.min(feasibleMax, hardMax));
        }
        return low + random.nextInt(high - low + 1);
    }

    private List<Double> allocateStockWeights(
            int stockCount,
            double equityBudget,
            double minW,
            double maxW,
            ThreadLocalRandom random
    ) {
        int maxLargeByCap = Math.max(0, (int) Math.floor(ABOVE_5_PCT_SUM_MAX / ABOVE_5_PCT_THRESHOLD));
        int maxLargeByCount = Math.max(0, stockCount / 3);
        int largeCount = Math.min(maxLargeByCap, maxLargeByCount);
        if (largeCount > 0) {
            largeCount = 1 + random.nextInt(largeCount);
        }
        int smallCount = stockCount - largeCount;

        double smallFloor = smallCount * minW;
        double largeFloor = largeCount * ABOVE_5_PCT_THRESHOLD;
        double remainingAfterFloors = equityBudget - smallFloor - largeFloor;

        if (remainingAfterFloors < 0) {
            return equalWeightsClipped(stockCount, equityBudget, minW, maxW);
        }

        double largeHeadroom = Math.min(
                ABOVE_5_PCT_SUM_MAX - largeFloor,
                largeCount * (maxW - ABOVE_5_PCT_THRESHOLD)
        );
        double smallHeadroom = smallCount * (ABOVE_5_PCT_THRESHOLD - minW);

        double toLarge = largeCount == 0
                ? 0
                : Math.min(largeHeadroom, remainingAfterFloors * (0.35 + random.nextDouble() * 0.4));
        double toSmall = remainingAfterFloors - toLarge;
        if (toSmall > smallHeadroom) {
            double overflow = toSmall - smallHeadroom;
            toSmall = smallHeadroom;
            toLarge = Math.min(largeHeadroom, toLarge + overflow);
        }

        List<Double> weights = new ArrayList<>(stockCount);
        weights.addAll(spread(largeCount, ABOVE_5_PCT_THRESHOLD, toLarge, maxW, random));
        weights.addAll(spread(smallCount, minW, toSmall, ABOVE_5_PCT_THRESHOLD, random));

        double sum = weights.stream().mapToDouble(Double::doubleValue).sum();
        double drift = equityBudget - sum;
        if (!weights.isEmpty() && Math.abs(drift) > 1e-6) {
            int idx = 0;
            double adjusted = Math.min(maxW, Math.max(minW, weights.get(idx) + drift));
            weights.set(idx, adjusted);
        }

        Collections.shuffle(weights, random);
        return weights;
    }

    private List<Double> spread(
            int count,
            double base,
            double extraBudget,
            double maxW,
            ThreadLocalRandom random
    ) {
        if (count <= 0) {
            return List.of();
        }
        List<Double> values = new ArrayList<>(count);
        double[] shares = randomShares(count, random);
        for (int i = 0; i < count; i++) {
            double w = base + extraBudget * shares[i];
            values.add(Math.min(maxW, w));
        }
        return values;
    }

    private double[] randomShares(int count, ThreadLocalRandom random) {
        double[] raw = new double[count];
        double sum = 0;
        for (int i = 0; i < count; i++) {
            raw[i] = 0.2 + random.nextDouble();
            sum += raw[i];
        }
        for (int i = 0; i < count; i++) {
            raw[i] /= sum;
        }
        return raw;
    }

    private List<Double> equalWeightsClipped(
            int stockCount,
            double equityBudget,
            double minW,
            double maxW
    ) {
        double equal = equityBudget / stockCount;
        double clipped = Math.min(maxW, Math.max(minW, equal));
        List<Double> weights = new ArrayList<>(stockCount);
        for (int i = 0; i < stockCount; i++) {
            weights.add(clipped);
        }
        double sum = clipped * stockCount;
        if (sum > 0 && Math.abs(sum - equityBudget) > 1e-6) {
            double scale = equityBudget / sum;
            for (int i = 0; i < stockCount; i++) {
                weights.set(i, Math.min(maxW, Math.max(minW, weights.get(i) * scale)));
            }
        }
        return weights;
    }

    private BigDecimal toWeight(double value) {
        return BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP);
    }
}
