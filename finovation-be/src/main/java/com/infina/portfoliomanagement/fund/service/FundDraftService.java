package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.dto.CreateFundDraftRequest;
import com.infina.portfoliomanagement.fund.dto.FundCurrencyOption;
import com.infina.portfoliomanagement.fund.dto.FundDraftInitResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftResponse;
import com.infina.portfoliomanagement.fund.dto.FundDraftSummaryResponse;
import com.infina.portfoliomanagement.fund.dto.ModelUniverseAssetResponse;
import com.infina.portfoliomanagement.fund.dto.UpdateFundDraftPortfolioRulesRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.FundDraftAnalysisStateResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisRequest;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAssetDto;
import com.infina.portfoliomanagement.fund.dto.analysis.WorkingPortfolioResponse;
import com.infina.portfoliomanagement.fund.entity.FundAssetPreference;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.ModelRun;
import com.infina.portfoliomanagement.fund.enums.FundAssetPreferenceType;
import com.infina.portfoliomanagement.fund.enums.FundCurrency;
import com.infina.portfoliomanagement.fund.enums.FundDesignInitPage;
import com.infina.portfoliomanagement.fund.enums.FundDesignSteps;
import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;
import com.infina.portfoliomanagement.fund.enums.FundType;
import com.infina.portfoliomanagement.fund.enums.InvestmentHorizon;
import com.infina.portfoliomanagement.fund.repository.FundAssetPreferenceRepository;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.service.analysis.FundModelClient;
import com.infina.portfoliomanagement.fund.support.FundRulesFingerprint;
import com.infina.portfoliomanagement.fund.validation.FundDraftValidator;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.entity.EquityDetail;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import com.infina.portfoliomanagement.marketdata.repository.EquityDetailRepository;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FundDraftService {

    private final FundDraftRepository fundDraftRepository;
    private final UserRepository userRepository;
    private final FundDesignProfileService fundDesignProfileService;
    private final FundModelClient fundModelClient;
    private final FundConstraintService fundConstraintService;
    private final FundAnalysisPersistenceService fundAnalysisPersistenceService;
    private final FundDraftValidator fundDraftValidator;
    private final FundAssetPreferenceRepository fundAssetPreferenceRepository;
    private final AssetRepository assetRepository;
    private final EquityDetailRepository equityDetailRepository;
    private final Clock clock;

    @Transactional(readOnly = true)
    public FundDraftInitResponse getInit(
            String actorUsername,
            FundDesignInitPage page,
            UUID draftId
    ) {
        FundProperties limits = fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE);

        return switch (page) {
            case START -> startInit(limits);
            case STRATEGY -> strategyInit(actorUsername, draftId, limits);
            case ANALYSIS, ALTERNATIVES, EDIT -> boundsInit(page, limits);
        };
    }

    @Transactional(readOnly = true)
    public List<ModelUniverseAssetResponse> listModelUniverse() {
        return loadModelUniverse();
    }

    private FundDraftInitResponse startInit(FundProperties limits) {
        return new FundDraftInitResponse(
                FundDesignInitPage.START,
                FundCurrencyOption.all(),
                FundCurrency.TRY.getCode(),
                limits.minInitialPortfolioSize(),
                limits.maxInitialPortfolioSize(),
                limits.minUnitPrice(),
                limits.maxUnitPrice(),
                limits.minLiquidityTargetPct(),
                limits.maxLiquidityTargetPct(),
                limits.minTppRangePct(),
                limits.minStockCount(),
                limits.maxStockCount(),
                limits.minStockCountRange(),
                limits.minSingleStockMaxPct(),
                limits.maxSingleStockMaxPct(),
                limits.minEquityWeightPct(),
                limits.maxEquityWeightPct(),
                limits.sectorMaxPct(),
                null,
                null
        );
    }

    private FundDraftInitResponse strategyInit(
            String actorUsername,
            UUID draftId,
            FundProperties limits
    ) {
        if (draftId == null) {
            throw new BaseException(ErrorCode.FUND_INIT_PAGE_INVALID);
        }
        FundDraftResponse draft = toResponse(requireOwnedDraft(actorUsername, draftId));
        return new FundDraftInitResponse(
                FundDesignInitPage.STRATEGY,
                null,
                null,
                null,
                null,
                null,
                null,
                limits.minLiquidityTargetPct(),
                limits.maxLiquidityTargetPct(),
                limits.minTppRangePct(),
                limits.minStockCount(),
                limits.maxStockCount(),
                limits.minStockCountRange(),
                limits.minSingleStockMaxPct(),
                limits.maxSingleStockMaxPct(),
                limits.minEquityWeightPct(),
                limits.maxEquityWeightPct(),
                limits.sectorMaxPct(),
                draft,
                loadModelUniverse()
        );
    }

    private FundDraftInitResponse boundsInit(FundDesignInitPage page, FundProperties limits) {
        return new FundDraftInitResponse(
                page,
                null,
                null,
                null,
                null,
                null,
                null,
                limits.minLiquidityTargetPct(),
                limits.maxLiquidityTargetPct(),
                limits.minTppRangePct(),
                limits.minStockCount(),
                limits.maxStockCount(),
                limits.minStockCountRange(),
                limits.minSingleStockMaxPct(),
                limits.maxSingleStockMaxPct(),
                limits.minEquityWeightPct(),
                limits.maxEquityWeightPct(),
                limits.sectorMaxPct(),
                null,
                null
        );
    }

    private List<ModelUniverseAssetResponse> loadModelUniverse() {
        List<Asset> assets = assetRepository
                .findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                        AssetType.EQUITY
                );
        if (assets.isEmpty()) {
            return List.of();
        }

        Map<Long, String> companyNameByAssetId = equityDetailRepository
                .findAllByAssetIdIn(assets.stream().map(Asset::getId).toList())
                .stream()
                .collect(Collectors.toMap(
                        EquityDetail::getAssetId,
                        EquityDetail::getCompanyName,
                        (left, right) -> left
                ));

        return assets.stream()
                .map(asset -> new ModelUniverseAssetResponse(
                        asset.getAssetCode(),
                        resolveDisplayName(asset, companyNameByAssetId.get(asset.getId()))
                ))
                .toList();
    }

    @Transactional
    public FundDraftResponse createDraft(String actorUsername, CreateFundDraftRequest request) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        FundProperties limits = fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE);
        fundDraftValidator.assertCreateRequest(
                request.name(),
                request.initialPortfolioSize(),
                request.unitPrice(),
                limits
        );

        LocalDateTime now = LocalDateTime.now(clock);
        FundDraft draft = FundDraft.newDraft(
                request.name().trim(),
                request.initialPortfolioSize(),
                request.unitPrice(),
                actor.getId(),
                now
        );
        FundDraft saved = fundDraftRepository.save(draft);
        fundConstraintService.saveProfileConstraints(saved, limits, now);

        log.info("Fund draft {} created by user {}", saved.getPublicId(), actor.getId());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public FundDraftResponse getDraft(String actorUsername, UUID draftId) {
        return toResponse(requireOwnedDraft(actorUsername, draftId));
    }

    @Transactional(readOnly = true)
    public List<FundDraftSummaryResponse> listInProgressDrafts(String actorUsername) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
        return fundDraftRepository
                .findAllByStatusAndCreatedByUserIdOrderByCreatedAtDescIdDesc(
                        FundDraftStatus.IN_PROGRESS,
                        actor.getId()
                )
                .stream()
                .map(FundDraftSummaryResponse::from)
                .toList();
    }

    @Transactional
    public FundDraftResponse updatePortfolioRules(
            String actorUsername,
            UUID draftId,
            UpdateFundDraftPortfolioRulesRequest request
    ) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        FundProperties limits = fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE);
        fundDraftValidator.assertPortfolioRulesAreValid(request, limits);

        List<String> excludedCodes = normalizeAssetCodes(request.excludedAssetCodes());
        List<String> forcedCodes = normalizeAssetCodes(request.forcedAssetCodes());
        Map<String, Asset> resolvedAssets = resolveUniverseAssets(excludedCodes, forcedCodes);
        fundDraftValidator.assertAssetPreferencesValid(
                excludedCodes,
                forcedCodes,
                request.minStockCount()
        );

        LocalDateTime now = LocalDateTime.now(clock);
        draft.setManagementApproach(request.managementApproach());
        draft.setTppMinPct(request.tppMinPct().shortValue());
        draft.setTppMaxPct(request.tppMaxPct().shortValue());
        draft.setPreferredTppPct(request.preferredTppPct().shortValue());
        draft.setLiquidityTargetPct(request.preferredTppPct().shortValue());
        draft.setMinStockCount(request.minStockCount().shortValue());
        draft.setMaxStockCount(request.maxStockCount().shortValue());
        draft.setEquityMinPct((short) limits.minEquityWeightPct());
        draft.setEquityMaxPct((short) limits.maxEquityWeightPct());
        draft.setSingleStockMaxPct((short) limits.maxSingleStockMaxPct());
        advanceCurrentStep(draft, FundDesignSteps.ANALYSIS);
        draft.setUpdatedAt(now);

        FundDraft saved = fundDraftRepository.save(draft);
        fundConstraintService.replacePortfolioRuleConstraints(
                saved,
                limits,
                request.minStockCount(),
                request.maxStockCount(),
                now
        );
        replaceAssetPreferences(saved.getId(), excludedCodes, forcedCodes, resolvedAssets, now);
        fundAnalysisPersistenceService.invalidateRunsForDraft(saved.getId());

        log.info(
                "Fund draft {} portfolio rules updated by user {}",
                saved.getPublicId(),
                draft.getCreatedByUserId()
        );
        return toResponse(saved, excludedCodes, forcedCodes);
    }

    @Transactional(readOnly = true)
    public FundDraftAnalysisStateResponse getAnalysisState(String actorUsername, UUID draftId) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        String fingerprint = currentFingerprint(draft);
        return fundAnalysisPersistenceService.loadState(draft, fingerprint);
    }

    public FundModelAnalysisResponse runAnalysis(String actorUsername, UUID draftId) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        fundDraftValidator.assertStrategyReadyForAnalysis(draft);

        String fingerprint = currentFingerprint(draft);
        FundDraftAnalysisStateResponse existing =
                fundAnalysisPersistenceService.loadState(draft, fingerprint);
        if (!existing.proposals().isEmpty()) {
            return new FundModelAnalysisResponse(existing.proposals());
        }

        FundProperties limits = fundDesignProfileService.getLimits(FundType.EQUITY_INTENSIVE);
        FundModelAnalysisRequest request = toAnalysisRequest(draft, limits);
        ModelRun run = fundAnalysisPersistenceService.startRun(draft, fingerprint);
        try {
            FundModelAnalysisResponse response = fundModelClient.analyze(request);
            fundAnalysisPersistenceService.completeRun(run, draft, response, fingerprint);
            log.info(
                    "Fund draft {} analysis completed by user {} with {} proposals",
                    draft.getPublicId(),
                    draft.getCreatedByUserId(),
                    response.proposals() == null ? 0 : response.proposals().size()
            );
            return response;
        } catch (RuntimeException ex) {
            fundAnalysisPersistenceService.failRun(
                    run,
                    "ANALYSIS_FAILED",
                    ex.getMessage()
            );
            throw ex;
        }
    }

    @Transactional
    public FundDraftAnalysisStateResponse selectProposal(
            String actorUsername,
            UUID draftId,
            int rank
    ) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        String fingerprint = currentFingerprint(draft);
        FundDraftAnalysisStateResponse state =
                fundAnalysisPersistenceService.selectProposal(draft, fingerprint, rank);
        advanceCurrentStep(draft, FundDesignSteps.EDIT);
        draft.setUpdatedAt(LocalDateTime.now(clock));
        fundDraftRepository.save(draft);
        return state;
    }

    @Transactional(readOnly = true)
    public WorkingPortfolioResponse getWorkingPortfolio(String actorUsername, UUID draftId) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        return fundAnalysisPersistenceService.getWorking(draft);
    }

    @Transactional
    public WorkingPortfolioResponse updateWorkingPortfolio(
            String actorUsername,
            UUID draftId,
            List<FundModelAssetDto> assets
    ) {
        FundDraft draft = requireOwnedDraft(actorUsername, draftId);
        WorkingPortfolioResponse response =
                fundAnalysisPersistenceService.replaceWorking(draft, assets);
        draft.setUpdatedAt(LocalDateTime.now(clock));
        fundDraftRepository.save(draft);
        return response;
    }

    private String currentFingerprint(FundDraft draft) {
        return FundRulesFingerprint.fromDraft(
                draft,
                loadExcludedCodes(draft.getId()),
                loadForcedCodes(draft.getId())
        );
    }

    private FundDraftResponse toResponse(FundDraft draft) {
        return toResponse(draft, loadExcludedCodes(draft.getId()), loadForcedCodes(draft.getId()));
    }

    private FundDraftResponse toResponse(
            FundDraft draft,
            List<String> excludedCodes,
            List<String> forcedCodes
    ) {
        return FundDraftResponse.from(draft, excludedCodes, forcedCodes);
    }

    private void replaceAssetPreferences(
            Long draftId,
            List<String> excludedCodes,
            List<String> forcedCodes,
            Map<String, Asset> resolvedAssets,
            LocalDateTime now
    ) {
        fundAssetPreferenceRepository.deleteAllByFundDraftId(draftId);
        fundAssetPreferenceRepository.flush();

        List<FundAssetPreference> preferences = new ArrayList<>();
        for (String code : excludedCodes) {
            preferences.add(FundAssetPreference.builder()
                    .fundDraftId(draftId)
                    .assetId(resolvedAssets.get(code).getId())
                    .preferenceType(FundAssetPreferenceType.EXCLUDE)
                    .createdAt(now)
                    .build());
        }
        for (String code : forcedCodes) {
            preferences.add(FundAssetPreference.builder()
                    .fundDraftId(draftId)
                    .assetId(resolvedAssets.get(code).getId())
                    .preferenceType(FundAssetPreferenceType.INCLUDE)
                    .createdAt(now)
                    .build());
        }
        if (!preferences.isEmpty()) {
            fundAssetPreferenceRepository.saveAll(preferences);
        }
    }

    private List<String> loadExcludedCodes(Long draftId) {
        return loadPreferenceCodes(draftId, FundAssetPreferenceType.EXCLUDE);
    }

    private List<String> loadForcedCodes(Long draftId) {
        return loadPreferenceCodes(draftId, FundAssetPreferenceType.INCLUDE);
    }

    private List<String> loadPreferenceCodes(Long draftId, FundAssetPreferenceType type) {
        if (draftId == null) {
            return List.of();
        }
        return toAssetCodes(
                fundAssetPreferenceRepository
                        .findAllByFundDraftIdAndPreferenceType(draftId, type)
                        .stream()
                        .map(FundAssetPreference::getAssetId)
                        .toList()
        );
    }

    private List<String> toAssetCodes(List<Long> assetIds) {
        if (assetIds.isEmpty()) {
            return List.of();
        }
        Map<Long, String> byId = assetRepository.findAllById(assetIds).stream()
                .collect(Collectors.toMap(Asset::getId, Asset::getAssetCode));
        return assetIds.stream()
                .map(byId::get)
                .filter(code -> code != null && !code.isBlank())
                .sorted()
                .toList();
    }

    private List<String> normalizeAssetCodes(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String raw : codes) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String normalized = raw.trim().toUpperCase(Locale.ROOT);
            unique.putIfAbsent(normalized, normalized);
        }
        return List.copyOf(unique.values());
    }

    private Map<String, Asset> resolveUniverseAssets(
            List<String> excludedCodes,
            List<String> forcedCodes
    ) {
        Set<String> requested = new HashSet<>();
        requested.addAll(excludedCodes);
        requested.addAll(forcedCodes);
        if (requested.isEmpty()) {
            return Map.of();
        }

        Map<String, Asset> universeByCode = assetRepository
                .findAllByAssetTypeAndInModelUniverseTrueAndActiveTrueOrderByAssetCodeAsc(
                        AssetType.EQUITY
                )
                .stream()
                .collect(Collectors.toMap(
                        asset -> asset.getAssetCode().toUpperCase(Locale.ROOT),
                        asset -> asset,
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        List<String> unknown = requested.stream()
                .filter(code -> !universeByCode.containsKey(code))
                .sorted()
                .toList();
        if (!unknown.isEmpty()) {
            throw new BaseException(ErrorCode.FUND_ASSET_PREFERENCE_INVALID);
        }

        Map<String, Asset> resolved = new LinkedHashMap<>();
        for (String code : requested) {
            resolved.put(code, universeByCode.get(code));
        }
        return resolved;
    }

    private void advanceCurrentStep(FundDraft draft, int step) {
        Short current = draft.getCurrentStep();
        if (current == null || current < step) {
            draft.setCurrentStep((short) step);
        }
    }

    private FundModelAnalysisRequest toAnalysisRequest(FundDraft draft, FundProperties limits) {
        InvestmentHorizon horizon =
                draft.getHorizon() != null ? draft.getHorizon() : InvestmentHorizon.M12;
        int singleStockMax = draft.getSingleStockMaxPct() != null
                ? draft.getSingleStockMaxPct()
                : limits.maxSingleStockMaxPct();
        int equityMin = draft.getEquityMinPct() != null
                ? draft.getEquityMinPct()
                : limits.minEquityWeightPct();
        int equityMax = draft.getEquityMaxPct() != null
                ? draft.getEquityMaxPct()
                : limits.maxEquityWeightPct();

        return new FundModelAnalysisRequest(
                horizon,
                draft.getMinStockCount().intValue(),
                draft.getMaxStockCount().intValue(),
                draft.getTppMinPct().intValue(),
                draft.getTppMaxPct().intValue(),
                draft.getPreferredTppPct().intValue(),
                singleStockMax,
                limits.sectorMaxPct(),
                equityMin,
                equityMax,
                loadExcludedCodes(draft.getId()),
                loadForcedCodes(draft.getId())
        );
    }

    private FundDraft requireOwnedDraft(String actorUsername, UUID draftId) {
        User actor = userRepository.findByUsername(actorUsername)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));
        FundDraft draft = fundDraftRepository.findByPublicId(draftId)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_DRAFT_NOT_FOUND));
        if (!draft.getCreatedByUserId().equals(actor.getId())) {
            throw new BaseException(ErrorCode.ACCESS_DENIED);
        }
        return draft;
    }

    private static String resolveDisplayName(Asset asset, String companyName) {
        if (asset.getDisplayName() != null && !asset.getDisplayName().isBlank()) {
            return asset.getDisplayName();
        }
        if (companyName != null && !companyName.isBlank()) {
            return companyName;
        }
        return asset.getAssetCode();
    }
}
