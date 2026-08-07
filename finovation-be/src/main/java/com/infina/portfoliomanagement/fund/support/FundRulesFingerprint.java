package com.infina.portfoliomanagement.fund.support;

import com.infina.portfoliomanagement.fund.entity.FundDraft;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class FundRulesFingerprint {

    private FundRulesFingerprint() {
    }

    public static String fromDraft(
            FundDraft draft,
            List<String> excludedAssetCodes,
            List<String> forcedAssetCodes
    ) {
        return build(
                draft.getManagementApproach() == null
                        ? null
                        : draft.getManagementApproach().name(),
                draft.getTppMinPct(),
                draft.getTppMaxPct(),
                draft.getPreferredTppPct(),
                draft.getMinStockCount(),
                draft.getMaxStockCount(),
                excludedAssetCodes,
                forcedAssetCodes
        );
    }

    public static String build(
            String managementApproach,
            Number tppMinPct,
            Number tppMaxPct,
            Number preferredTppPct,
            Number minStockCount,
            Number maxStockCount,
            List<String> excludedAssetCodes,
            List<String> forcedAssetCodes
    ) {
        List<String> excluded = sortedCopy(excludedAssetCodes);
        List<String> forced = sortedCopy(forcedAssetCodes);
        return String.join(
                "|",
                nullToEmpty(managementApproach),
                nullToEmpty(tppMinPct),
                nullToEmpty(tppMaxPct),
                nullToEmpty(preferredTppPct),
                nullToEmpty(minStockCount),
                nullToEmpty(maxStockCount),
                String.join(",", excluded),
                String.join(",", forced)
        );
    }

    private static List<String> sortedCopy(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return List.of();
        }
        List<String> copy = new ArrayList<>(codes);
        Collections.sort(copy);
        return copy;
    }

    private static String nullToEmpty(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
