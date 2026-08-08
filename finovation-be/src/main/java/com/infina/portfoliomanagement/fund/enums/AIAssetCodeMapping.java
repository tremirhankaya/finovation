package com.infina.portfoliomanagement.fund.enums;

import java.util.Arrays;
import java.util.Optional;

public enum AIAssetCodeMapping {
    CASH_TPP("TPP1G");

    private final String internalCode;

    AIAssetCodeMapping(String internalCode) {
        this.internalCode = internalCode;
    }

    public String getInternalCode() {
        return internalCode;
    }

    public static Optional<String> resolveInternalCode(String aiCode) {
        return Arrays.stream(values())
                .filter(mapping -> mapping.name().equals(aiCode))
                .findFirst()
                .map(AIAssetCodeMapping::getInternalCode);
    }
}
