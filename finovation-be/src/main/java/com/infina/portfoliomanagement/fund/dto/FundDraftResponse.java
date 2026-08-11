package com.infina.portfoliomanagement.fund.dto;



import com.infina.portfoliomanagement.fund.entity.FundDraft;

import com.infina.portfoliomanagement.fund.enums.FundDesignMode;

import com.infina.portfoliomanagement.fund.enums.FundDraftStatus;

import com.infina.portfoliomanagement.fund.enums.FundType;

import com.infina.portfoliomanagement.fund.enums.InvestmentHorizon;

import com.infina.portfoliomanagement.fund.enums.ManagementApproach;

import lombok.Builder;



import java.math.BigDecimal;

import java.time.LocalDateTime;

import java.util.List;

import java.util.UUID;



@Builder

public record FundDraftResponse(

        UUID draftId,

        Integer draftVersion,

        String name,

        FundType fundType,

        String currency,

        BigDecimal initialPortfolioSize,

        BigDecimal unitPrice,

        ManagementApproach managementApproach,

        Short liquidityTargetPct,

        InvestmentHorizon horizon,

        Short tppMinPct,

        Short tppMaxPct,

        Short preferredTppPct,

        Short minStockCount,

        Short maxStockCount,

        Short equityMinPct,

        Short equityMaxPct,

        Short singleStockMaxPct,

        Integer currentStep,

        FundDraftStatus status,

        FundDesignMode designMode,

        boolean pinned,

        LocalDateTime createdAt,

        LocalDateTime updatedAt,

        List<String> excludedAssetCodes,

        List<String> forcedAssetCodes

) {

    public static FundDraftResponse from(FundDraft draft) {

        return from(draft, List.of(), List.of());

    }



    public static FundDraftResponse from(

            FundDraft draft,

            List<String> excludedAssetCodes,

            List<String> forcedAssetCodes

    ) {

        return FundDraftResponse.builder()

                .draftId(draft.getPublicId())

                .draftVersion(draft.getVersion())

                .name(draft.getName())

                .fundType(draft.getFundType())

                .currency(draft.getCurrencyCode())

                .initialPortfolioSize(draft.getInitialPortfolioSize())

                .unitPrice(draft.getUnitPrice())

                .managementApproach(draft.getManagementApproach())

                .liquidityTargetPct(draft.getLiquidityTargetPct())

                .horizon(draft.getHorizon())

                .tppMinPct(draft.getTppMinPct())

                .tppMaxPct(draft.getTppMaxPct())

                .preferredTppPct(draft.getPreferredTppPct())

                .minStockCount(draft.getMinStockCount())

                .maxStockCount(draft.getMaxStockCount())

                .equityMinPct(draft.getEquityMinPct())

                .equityMaxPct(draft.getEquityMaxPct())

                .singleStockMaxPct(draft.getSingleStockMaxPct())

                .currentStep(draft.getCurrentStep() == null ? null : draft.getCurrentStep().intValue())

                .status(draft.getStatus())

                .designMode(draft.getDesignMode())

                .pinned(draft.isPinned())

                .createdAt(draft.getCreatedAt())

                .updatedAt(draft.getUpdatedAt())

                .excludedAssetCodes(excludedAssetCodes == null ? List.of() : List.copyOf(excludedAssetCodes))

                .forcedAssetCodes(forcedAssetCodes == null ? List.of() : List.copyOf(forcedAssetCodes))

                .build();

    }

}


