package com.infina.portfoliomanagement.fund.validation;

import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.fund.config.FundProperties;
import com.infina.portfoliomanagement.fund.dto.UpdateFundDraftPortfolioRulesRequest;
import com.infina.portfoliomanagement.fund.entity.FundDraft;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class FundDraftValidator {

    public void assertCreateRequest(
            String name,
            BigDecimal initialPortfolioSize,
            BigDecimal unitPrice,
            FundProperties limits
    ) {
        assertFundNameIsValid(name);
        assertInitialSizeIsInRange(initialPortfolioSize, limits);
        assertUnitPriceIsInRange(unitPrice, limits);
    }

    public void assertPortfolioRulesAreValid(
            UpdateFundDraftPortfolioRulesRequest request,
            FundProperties limits
    ) {
        int tppMin = request.tppMinPct();
        int tppMax = request.tppMaxPct();
        int preferred = request.preferredTppPct();
        int stockMin = request.minStockCount();
        int stockMax = request.maxStockCount();

        boolean tppOutOfBounds =
                tppMin < limits.minLiquidityTargetPct()
                        || tppMax > limits.maxLiquidityTargetPct()
                        || tppMin > tppMax
                        || (tppMax - tppMin) < limits.minTppRangePct();
        boolean preferredOutOfBounds = preferred < tppMin || preferred > tppMax;
        boolean stockOutOfBounds =
                stockMin < limits.minStockCount()
                        || stockMax > limits.maxStockCount()
                        || stockMin > stockMax
                        || (stockMax - stockMin) < limits.minStockCountRange();

        if (tppOutOfBounds || preferredOutOfBounds || stockOutOfBounds) {
            throw new BaseException(ErrorCode.FUND_PORTFOLIO_RULES_INVALID);
        }
    }

    public void assertAssetPreferencesValid(
            List<String> excludedCodes,
            List<String> forcedCodes,
            int minStockCount,
            int maxAssetPreferences
    ) {
        Set<String> excluded = new HashSet<>(excludedCodes);
        for (String forced : forcedCodes) {
            if (excluded.contains(forced)) {
                throw new BaseException(ErrorCode.FUND_ASSET_PREFERENCE_INVALID);
            }
        }
        if (forcedCodes.size() > maxAssetPreferences
                || excludedCodes.size() > maxAssetPreferences
                || forcedCodes.size() > minStockCount) {
            throw new BaseException(ErrorCode.FUND_ASSET_PREFERENCE_INVALID);
        }
    }

    public void assertStrategyReadyForAnalysis(FundDraft draft) {
        boolean incomplete =
                draft.getManagementApproach() == null
                        || draft.getTppMinPct() == null
                        || draft.getTppMaxPct() == null
                        || draft.getPreferredTppPct() == null
                        || draft.getMinStockCount() == null
                        || draft.getMaxStockCount() == null;
        if (incomplete) {
            throw new BaseException(ErrorCode.FUND_STRATEGY_INCOMPLETE);
        }
    }

    private void assertFundNameIsValid(String name) {
        if (!FundNameRules.isValid(name)) {
            throw new BaseException(ErrorCode.FUND_NAME_INVALID);
        }
    }

    private void assertInitialSizeIsInRange(BigDecimal initialPortfolioSize, FundProperties limits) {
        boolean belowMinimum =
                initialPortfolioSize.compareTo(limits.minInitialPortfolioSize()) < 0;
        boolean aboveMaximum =
                initialPortfolioSize.compareTo(limits.maxInitialPortfolioSize()) > 0;
        if (belowMinimum || aboveMaximum) {
            throw new BaseException(ErrorCode.FUND_INITIAL_SIZE_OUT_OF_RANGE);
        }
    }

    private void assertUnitPriceIsInRange(BigDecimal unitPrice, FundProperties limits) {
        boolean belowMinimum = unitPrice.compareTo(limits.minUnitPrice()) < 0;
        boolean aboveMaximum = unitPrice.compareTo(limits.maxUnitPrice()) > 0;
        if (belowMinimum || aboveMaximum) {
            throw new BaseException(ErrorCode.FUND_UNIT_PRICE_OUT_OF_RANGE);
        }
    }
}
