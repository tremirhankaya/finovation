package com.infina.portfoliomanagement.fund.enums;

public enum FundCurrency {
    TRY("TRY", "TRY - Türk Lirası");

    private final String code;
    private final String label;

    FundCurrency(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }
}
