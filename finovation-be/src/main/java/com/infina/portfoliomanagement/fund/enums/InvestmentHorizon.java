package com.infina.portfoliomanagement.fund.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum InvestmentHorizon {
    M3("3M"),
    M6("6M"),
    M12("12M");

    private final String code;

    InvestmentHorizon(String code) {
        this.code = code;
    }

    @JsonValue
    public String code() {
        return code;
    }

    @JsonCreator
    public static InvestmentHorizon fromCode(String code) {
        return Arrays.stream(values())
                .filter(value -> value.code.equals(code))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown horizon: " + code));
    }
}
