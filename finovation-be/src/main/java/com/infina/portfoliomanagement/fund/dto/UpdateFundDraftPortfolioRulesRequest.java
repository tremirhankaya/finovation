package com.infina.portfoliomanagement.fund.dto;



import com.infina.portfoliomanagement.fund.enums.ManagementApproach;

import jakarta.validation.constraints.Max;

import jakarta.validation.constraints.Min;

import jakarta.validation.constraints.NotNull;



import java.util.List;



public record UpdateFundDraftPortfolioRulesRequest(

        @NotNull

        ManagementApproach managementApproach,



        @NotNull

        @Min(0)

        @Max(100)

        Integer tppMinPct,



        @NotNull

        @Min(0)

        @Max(100)

        Integer tppMaxPct,



        @NotNull

        @Min(0)

        @Max(100)

        Integer preferredTppPct,



        @NotNull

        @Min(1)

        Integer minStockCount,



        @NotNull

        @Min(1)

        Integer maxStockCount,



        List<String> excludedAssetCodes,



        List<String> forcedAssetCodes

) {

}


