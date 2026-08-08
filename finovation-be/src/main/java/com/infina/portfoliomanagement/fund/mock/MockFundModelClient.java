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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;


@Slf4j
@Component
@RequiredArgsConstructor
public class MockFundModelClient implements FundModelClient {

    private static final double MIN_STOCK_WEIGHT = 0.03;
    private static final double ABOVE_5_PCT_THRESHOLD = 0.05;
    private static final double ABOVE_5_PCT_SUM_MAX = 0.40;

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

    @Override
    public FundModelAnalysisResponse analyze(FundModelAnalysisRequest request) {
        log.info(
                "Mock fund model analysis started (minStock={}, maxStock={}, tpp={}–{}, preferred={})",
                request.minStockCount(),
                request.maxStockCount(),
                request.tppMinWeight(),
                request.tppMaxWeight(),
                request.preferredTppWeight()
        );

        // TODO: Burada Python model servisine HTTP isteği atılacak.

        try {
            Thread.sleep(2500);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }

        List<String> equityCodes = loadEquityUniverseCodes(request);
        String tppCode = loadTppCode();

        int proposalCount = 2;
        List<FundModelProposalDto> proposals = new ArrayList<>(proposalCount);
        for (int rank = 1; rank <= proposalCount; rank++) {
            proposals.add(new FundModelProposalDto(
                    rank,
                    PROPOSAL_LABELS.get((rank - 1) % PROPOSAL_LABELS.size()),
                    buildRuleCompliantPortfolio(request, equityCodes, tppCode)
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
            String tppCode
    ) {
        ThreadLocalRandom random = ThreadLocalRandom.current();

        double tppWeight = resolveFixedTppWeight(request);
        double equityBudget = 1.0 - tppWeight;

        double maxStockWeight = Math.min(
                request.maxAnyStockWeight() / 100.0,
                equityBudget
        );
        double minStockWeight = Math.min(MIN_STOCK_WEIGHT, maxStockWeight);

        List<String> forced = request.forcedAssets() == null
                ? List.of()
                : request.forcedAssets().stream()
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
        stockCount = Math.max(stockCount, forced.size());
        stockCount = Math.min(stockCount, equityCodes.size());

        List<Double> stockWeights = allocateStockWeights(
                stockCount,
                equityBudget,
                minStockWeight,
                maxStockWeight,
                random
        );

        List<String> tickers = new ArrayList<>(forced);
        List<String> remainder = equityCodes.stream()
                .filter(code -> !forced.contains(code))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        Collections.shuffle(remainder, random);
        tickers.addAll(remainder);

        List<FundModelAssetDto> assets = new ArrayList<>(stockCount + 1);
        for (int i = 0; i < stockCount; i++) {
            String code = tickers.get(i);
            String note = forced.contains(code)
                    ? "Zorunlu hisse"
                    : SAMPLE_NOTES.get(random.nextInt(SAMPLE_NOTES.size()));
            assets.add(new FundModelAssetDto(
                    code,
                    toWeight(stockWeights.get(i)),
                    note
            ));
        }

        assets.sort(Comparator.comparing(FundModelAssetDto::weight).reversed());

        assets.add(new FundModelAssetDto(
                tppCode,
                toWeight(tppWeight),
                "Sabit likidite (TPP)"
        ));

        return assets;
    }

    private double resolveFixedTppWeight(FundModelAnalysisRequest request) {
        int preferred = request.preferredTppWeight() != null
                ? request.preferredTppWeight()
                : (request.tppMinWeight() + request.tppMaxWeight()) / 2;
        int clamped = Math.max(
                request.tppMinWeight(),
                Math.min(request.tppMaxWeight(), preferred)
        );
        return clamped / 100.0;
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
