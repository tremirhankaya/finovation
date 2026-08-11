package com.infina.portfoliomanagement.fund.service;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.common.time.FinancialTimeProvider;
import com.infina.portfoliomanagement.common.enums.AssetType;
import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.dto.analysis.FundDraftAnalysisStateResponse;
import com.infina.portfoliomanagement.fund.enums.AIAssetCodeMapping;
import com.infina.portfoliomanagement.fund.dto.analysis.FundEngineAlternativeDto;
import com.infina.portfoliomanagement.fund.dto.analysis.FundEngineCreateResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAnalysisResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelAssetDto;
import com.infina.portfoliomanagement.fund.dto.analysis.FundModelProposalDto;
import com.infina.portfoliomanagement.fund.dto.analysis.FundPositionResponse;
import com.infina.portfoliomanagement.fund.dto.analysis.WorkingPortfolioResponse;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import com.infina.portfoliomanagement.fund.entity.FundPortfolio;
import com.infina.portfoliomanagement.fund.entity.FundPosition;
import com.infina.portfoliomanagement.fund.entity.ModelRun;
import com.infina.portfoliomanagement.fund.enums.ConstraintCode;
import com.infina.portfoliomanagement.fund.enums.FundDesignSteps;
import com.infina.portfoliomanagement.fund.enums.ModelRunStatus;
import com.infina.portfoliomanagement.fund.enums.PortfolioType;
import com.infina.portfoliomanagement.fund.repository.FundDraftRepository;
import com.infina.portfoliomanagement.fund.repository.FundPortfolioRepository;
import com.infina.portfoliomanagement.fund.repository.FundPositionRepository;
import com.infina.portfoliomanagement.fund.repository.ModelRunRepository;
import com.infina.portfoliomanagement.fund.rules.PortfolioRuleLimits;
import com.infina.portfoliomanagement.fund.rules.RuleViolation;
import com.infina.portfoliomanagement.fund.rules.WorkingPortfolioRules;
import com.infina.portfoliomanagement.marketdata.entity.Asset;
import com.infina.portfoliomanagement.marketdata.repository.AssetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FundAnalysisPersistenceService {

    private final ModelRunRepository modelRunRepository;
    private final FundPortfolioRepository fundPortfolioRepository;
    private final FundPositionRepository fundPositionRepository;
    private final FundDraftRepository fundDraftRepository;
    private final AssetRepository assetRepository;
    private final FinancialTimeProvider financialTime;

    @Transactional
    public void invalidateRunsForDraft(Long draftId) {
        LocalDateTime now = financialTime.now();
        List<ModelRun> completed = modelRunRepository
                .findAllByFundDraft_IdAndStatus(draftId, ModelRunStatus.COMPLETED);
        for (ModelRun run : completed) {
            run.setStatus(ModelRunStatus.SUPERSEDED);
            run.setUpdatedAt(now);
        }
        if (!completed.isEmpty()) {
            modelRunRepository.saveAll(completed);
        }

        List<FundPortfolio> selected =
                fundPortfolioRepository.findAllByFundDraft_IdAndSelectedTrue(draftId);
        for (FundPortfolio portfolio : selected) {
            portfolio.setSelected(false);
            portfolio.setUpdatedAt(now);
        }
        if (!selected.isEmpty()) {
            fundPortfolioRepository.saveAll(selected);
        }

        fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(draftId, PortfolioType.WORKING)
                .ifPresent(this::deletePortfolioWithPositions);
    }

    @Transactional
    public ModelRun startRun(FundDraft draft, String rulesFingerprint) {
        LocalDateTime now = financialTime.now();
        invalidateRunsForDraft(draft.getId());

        ModelRun run = ModelRun.builder()
                .fundDraft(draft)
                .status(ModelRunStatus.GENERATING_PROPOSALS)
                .dataCutoffDate(financialTime.currentDate())
                .modelVersion("mock-v1")
                .rulesFingerprint(rulesFingerprint)
                .startedAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        return modelRunRepository.save(run);
    }

    @Transactional
    public void completeRun(
            ModelRun run,
            FundDraft draft,
            FundEngineCreateResponse response,
            String rulesFingerprint
    ) {
        LocalDateTime now = financialTime.now();
        List<FundEngineAlternativeDto> alternatives =
                response.alternatives() == null ? List.of() : response.alternatives();

        Map<String, Asset> assetsByCode = resolveAssets(
                alternatives.stream()
                        .flatMap(alt -> alt.weights().keySet().stream())
                        .toList()
        );

        short rank = 1;
        for (FundEngineAlternativeDto alt : alternatives) {
            FundPortfolio portfolio = FundPortfolio.builder()
                    .publicId(UUID.randomUUID())
                    .version(0)
                    .fundDraft(draft)
                    .modelRunId(run.getId())
                    .portfolioType(PortfolioType.PROPOSAL)
                    .proposalRank(rank)
                    .selected(false)
                    .label("Alternatif " + rank)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            FundPortfolio saved = fundPortfolioRepository.save(portfolio);
            
            List<FundModelAssetDto> assets = alt.weights().entrySet().stream()
                    .map(entry -> {
                        String note = null;
                        if (alt.reasonTexts() != null && alt.reasonTexts().containsKey(entry.getKey())) {
                            List<String> reasons = alt.reasonTexts().get(entry.getKey());
                            if (reasons != null && !reasons.isEmpty()) {
                                note = String.join(", ", reasons);
                            }
                        }
                        return new FundModelAssetDto(
                                entry.getKey(),
                                BigDecimal.valueOf(entry.getValue()).multiply(BigDecimal.valueOf(100)), // Map decimal back to % for DB
                                note
                        );
                    })
                    .toList();
                    
            savePositions(saved, assets, assetsByCode, now);
            rank++;
        }

        run.setStatus(ModelRunStatus.COMPLETED);
        if (response.snapshotId() != null) {
            run.setModelVersion(response.snapshotId());
        }
        run.setRulesFingerprint(rulesFingerprint);
        run.setCompletedAt(now);
        run.setUpdatedAt(now);
        modelRunRepository.save(run);

        if (draft.getCurrentStep() == null
                || draft.getCurrentStep() < FundDesignSteps.ALTERNATIVES) {
            draft.setCurrentStep((short) FundDesignSteps.ALTERNATIVES);
        }
        draft.setUpdatedAt(now);
        fundDraftRepository.save(draft);
    }

    @Transactional
    public void failRun(ModelRun run, String errorCode, String message) {
        LocalDateTime now = financialTime.now();
        run.setStatus(ModelRunStatus.FAILED);
        run.setErrorCode(errorCode);
        run.setErrorMessage(message == null ? null : message.substring(0, Math.min(500, message.length())));
        run.setCompletedAt(now);
        run.setUpdatedAt(now);
        modelRunRepository.save(run);
    }

    @Transactional(readOnly = true)
    public FundDraftAnalysisStateResponse loadState(FundDraft draft, String rulesFingerprint) {
        ModelRun run = modelRunRepository
                .findFirstByFundDraft_IdAndStatusAndRulesFingerprintOrderByIdDesc(
                        draft.getId(),
                        ModelRunStatus.COMPLETED,
                        rulesFingerprint
                )
                .orElse(null);

        if (run == null) {
            return new FundDraftAnalysisStateResponse(rulesFingerprint, List.of(), null);
        }

        List<FundPortfolio> portfolios = fundPortfolioRepository
                .findAllByModelRunIdAndPortfolioTypeOrderByProposalRankAsc(
                        run.getId(),
                        PortfolioType.PROPOSAL
                );

        List<FundModelProposalDto> proposals = portfolios.stream()
                .map(this::toProposalDto)
                .toList();

        Integer selectedRank = portfolios.stream()
                .filter(FundPortfolio::isSelected)
                .map(portfolio -> portfolio.getProposalRank() == null
                        ? null
                        : portfolio.getProposalRank().intValue())
                .findFirst()
                .orElse(null);

        return new FundDraftAnalysisStateResponse(rulesFingerprint, proposals, selectedRank);
    }

    @Transactional
    public FundDraftAnalysisStateResponse selectProposal(
            FundDraft draft,
            String rulesFingerprint,
            int rank
    ) {
        ModelRun run = modelRunRepository
                .findFirstByFundDraft_IdAndStatusAndRulesFingerprintOrderByIdDesc(
                        draft.getId(),
                        ModelRunStatus.COMPLETED,
                        rulesFingerprint
                )
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_ANALYSIS_NOT_FOUND));

        FundPortfolio proposal = fundPortfolioRepository
                .findByModelRunIdAndProposalRank(run.getId(), (short) rank)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_PROPOSAL_NOT_FOUND));

        LocalDateTime now = financialTime.now();
        List<FundPortfolio> previouslySelected =
                fundPortfolioRepository.findAllByFundDraft_IdAndSelectedTrue(draft.getId());
        for (FundPortfolio portfolio : previouslySelected) {
            portfolio.setSelected(false);
            portfolio.setUpdatedAt(now);
        }
        if (!previouslySelected.isEmpty()) {
            fundPortfolioRepository.saveAll(previouslySelected);
        }
        proposal.setSelected(true);
        proposal.setUpdatedAt(now);
        fundPortfolioRepository.save(proposal);

        List<FundModelAssetDto> assets = toProposalDto(proposal).assets();
        upsertWorking(draft, proposal.getLabel(), assets, now);

        return loadState(draft, rulesFingerprint);
    }

    @Transactional(readOnly = true)
    public WorkingPortfolioResponse getWorking(FundDraft draft) {
        FundPortfolio working = fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(draft.getId(), PortfolioType.WORKING)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_ANALYSIS_NOT_FOUND));

        return buildWorking(draft, working);
    }

    @Transactional(readOnly = true)
    public Optional<WorkingPortfolioResponse> findWorking(FundDraft draft) {
        return fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(draft.getId(), PortfolioType.WORKING)
                .map(working -> buildWorking(draft, working));
    }

    private WorkingPortfolioResponse buildWorking(FundDraft draft, FundPortfolio working) {
        Integer sourceRank = fundPortfolioRepository
                .findByFundDraftIdAndSelectedTrue(draft.getId())
                .map(FundPortfolio::getProposalRank)
                .map(Short::intValue)
                .orElse(null);

        List<FundPositionResponse> assets =
                fundPositionRepository.findPositionResponsesByPortfolioId(working.getId());

        BigDecimal equityWeightPct = assets.stream()
                .filter(a -> a.assetType() == AssetType.EQUITY)
                .map(FundPositionResponse::weight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal tppWeightPct = assets.stream()
                .filter(a -> a.assetType() == AssetType.TPP)
                .map(FundPositionResponse::weight)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int stockCount = (int) assets.stream()
                .filter(a -> a.assetType() == AssetType.EQUITY)
                .count();

        int sectorCount = (int) assets.stream()
                .filter(a -> a.assetType() == AssetType.EQUITY && a.sectorName() != null)
                .map(FundPositionResponse::sectorName)
                .distinct()
                .count();

        return new WorkingPortfolioResponse(
                sourceRank,
                working.getLabel(),
                assets,
                equityWeightPct,
                tppWeightPct,
                stockCount,
                sectorCount
        );
    }

    @Transactional
    public WorkingPortfolioResponse replaceWorking(
            FundDraft draft,
            List<FundModelAssetDto> assets,
            FundProperties profileLimits
    ) {
        if (assets == null || assets.isEmpty()) {
            throw new BaseException(ErrorCode.FUND_WORKING_PORTFOLIO_INVALID);
        }
        LocalDateTime now = financialTime.now();
        FundPortfolio selected = fundPortfolioRepository
                .findByFundDraftIdAndSelectedTrue(draft.getId())
                .orElse(null);
        String label = resolvePortfolioLabel(selected);
        upsertWorking(draft, label, assets, now);

        WorkingPortfolioResponse response = getWorking(draft);
        return response;
    }

    @Transactional
    public void seedManualWorkingPortfolio(FundDraft draft, FundProperties profileLimits) {
        LocalDateTime now = financialTime.now();
        List<FundModelAssetDto> assets = List.of(
                new FundModelAssetDto(
                        AIAssetCodeMapping.CASH_TPP.getInternalCode(),
                        BigDecimal.valueOf(profileLimits.minLiquidityTargetPct()),
                        null
                )
        );
        upsertWorking(draft, "Manuel Portföy", assets, now);
    }


    @Transactional
    public void selectManualWorkingPortfolio(FundDraft draft) {
        FundPortfolio working = fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(draft.getId(), PortfolioType.WORKING)
                .orElseThrow(() -> new BaseException(ErrorCode.FUND_ANALYSIS_NOT_FOUND));

        working.setSelected(true);
        working.setUpdatedAt(financialTime.now());
        fundPortfolioRepository.save(working);
    }

    @Transactional(readOnly = true)
    public void assertWorkingPortfolioIsCompliant(FundDraft draft, FundProperties profileLimits) {
        assertRulesSatisfied(draft, getWorking(draft), profileLimits);
    }

    private void assertRulesSatisfied(
            FundDraft draft,
            WorkingPortfolioResponse response,
            FundProperties profileLimits
    ) {
        List<RuleViolation> violations = WorkingPortfolioRules.validate(
                response.assets(),
                PortfolioRuleLimits.from(draft, profileLimits)
        );
        if (violations.isEmpty()) {
            return;
        }
        log.warn(
                "Working portfolio for draft {} rejected by {} rule violations: {}",
                draft.getPublicId(),
                violations.size(),
                violations
        );
        throw new BaseException(toErrorCode(violations.getFirst().code()));
    }

    private static ErrorCode toErrorCode(ConstraintCode constraintCode) {
        return switch (constraintCode) {
            case TOTAL_WEIGHT -> ErrorCode.FUND_RULE_TOTAL_WEIGHT;
            case EQUITY_MIN -> ErrorCode.FUND_RULE_EQUITY_MIN;
            case EQUITY_MAX -> ErrorCode.FUND_RULE_EQUITY_MAX;
            case TPP_MIN -> ErrorCode.FUND_RULE_TPP_MIN;
            case TPP_MAX -> ErrorCode.FUND_RULE_TPP_MAX;
            case SINGLE_STOCK_MAX -> ErrorCode.FUND_RULE_SINGLE_STOCK_MAX;
            case ABOVE_THRESHOLD_SUM_MAX -> ErrorCode.FUND_RULE_ABOVE_THRESHOLD_SUM_MAX;
            case SECTOR_MAX -> ErrorCode.FUND_RULE_SECTOR_MAX;
            case MIN_STOCK_COUNT -> ErrorCode.FUND_RULE_MIN_STOCK_COUNT;
            case MAX_STOCK_COUNT -> ErrorCode.FUND_RULE_MAX_STOCK_COUNT;
        };
    }

    String resolvePortfolioLabel(FundPortfolio selected) {
        if (selected == null) {
            return PortfolioType.WORKING.getDefaultLabel();
        }

        if (selected.getLabel() != null) {
            return selected.getLabel();
        }

        PortfolioType portfolioType = selected.getPortfolioType();
        return portfolioType != null ? portfolioType.getDefaultLabel() : PortfolioType.WORKING.getDefaultLabel();
    }

    private void upsertWorking(
            FundDraft draft,
            String label,
            List<FundModelAssetDto> assets,
            LocalDateTime now
    ) {
        Map<String, Asset> assetsByCode = resolveAssets(
                assets.stream().map(FundModelAssetDto::assetCode).toList()
        );

        boolean hasTpp = assetsByCode.values().stream()
                .anyMatch(a -> a.getAssetType() == AssetType.TPP);
        if (!hasTpp) {
            throw new BaseException(ErrorCode.FUND_WORKING_PORTFOLIO_INVALID);
        }

        FundPortfolio working = fundPortfolioRepository
                .findByFundDraft_IdAndPortfolioType(draft.getId(), PortfolioType.WORKING)
                .orElseGet(() -> FundPortfolio.builder()
                        .publicId(UUID.randomUUID())
                        .version(0)
                        .fundDraft(draft)
                        .modelRunId(null)
                        .portfolioType(PortfolioType.WORKING)
                        .proposalRank(null)
                        .selected(false)
                        .createdAt(now)
                        .build());

        working.setLabel(label);
        working.setUpdatedAt(now);
        FundPortfolio saved = fundPortfolioRepository.save(working);

        fundPositionRepository.deleteAllByFundPortfolioId(saved.getId());
        fundPositionRepository.flush();
        savePositions(saved, assets, assetsByCode, now);
    }

    private void savePositions(
            FundPortfolio portfolio,
            List<FundModelAssetDto> assets,
            Map<String, Asset> assetsByCode,
            LocalDateTime now
    ) {
        List<FundPosition> rows = new ArrayList<>();
        for (FundModelAssetDto assetDto : assets) {
            String code = normalizeCode(assetDto.assetCode());
            Asset asset = assetsByCode.get(code);
            if (asset == null) {
                throw new BaseException(ErrorCode.FUND_WORKING_PORTFOLIO_INVALID);
            }
            rows.add(FundPosition.builder()
                    .fundPortfolio(portfolio)
                    .assetId(asset.getId())
                    .weight(assetDto.weight())
                    .aiNote(assetDto.aiNote())
                    .createdAt(now)
                    .updatedAt(now)
                    .build());
        }
        fundPositionRepository.saveAll(rows);
    }

    private FundModelProposalDto toProposalDto(FundPortfolio portfolio) {
        List<FundPosition> positions =
                fundPositionRepository.findAllByFundPortfolioIdOrderByWeightDesc(portfolio.getId());
        Map<Long, String> codesById = assetRepository
                .findAllById(positions.stream().map(FundPosition::getAssetId).toList())
                .stream()
                .collect(java.util.stream.Collectors.toMap(Asset::getId, Asset::getAssetCode));

        List<FundModelAssetDto> assets = positions.stream()
                .map(position -> new FundModelAssetDto(
                        codesById.get(position.getAssetId()),
                        position.getWeight(),
                        position.getAiNote()
                ))
                .toList();

        Integer rank = portfolio.getProposalRank() == null
                ? null
                : portfolio.getProposalRank().intValue();

        return new FundModelProposalDto(
                rank == null ? 0 : rank,
                portfolio.getLabel(),
                assets
        );
    }

    private Map<String, Asset> resolveAssets(List<String> codes) {
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String raw : codes) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String normalized = normalizeCode(raw);
            unique.putIfAbsent(normalized, normalized);
        }
        if (unique.isEmpty()) {
            return Map.of();
        }

        Map<String, Asset> byCode = new HashMap<>();
        for (String code : unique.keySet()) {
            assetRepository.findByAssetCode(code).ifPresent(asset -> byCode.put(code, asset));
        }
        if (byCode.size() != unique.size()) {
            throw new BaseException(ErrorCode.FUND_WORKING_PORTFOLIO_INVALID);
        }
        return byCode;
    }

    private void deletePortfolioWithPositions(FundPortfolio portfolio) {
        fundPositionRepository.deleteAllByFundPortfolioId(portfolio.getId());
        fundPositionRepository.flush();
        fundPortfolioRepository.delete(portfolio);
        fundPortfolioRepository.flush();
    }

    private static String normalizeCode(String code) {
        String normalized = code.trim().toUpperCase(Locale.ROOT);
        return AIAssetCodeMapping.resolveInternalCode(normalized).orElse(normalized);
    }
}
