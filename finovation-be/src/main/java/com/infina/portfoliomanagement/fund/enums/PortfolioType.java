package com.infina.portfoliomanagement.fund.enums;

public enum PortfolioType {
    PROPOSAL("Proposal"),
    WORKING("Working");

    private final String defaultLabel;

    PortfolioType(String defaultLabel) {
        this.defaultLabel = defaultLabel;
    }

    public String getDefaultLabel() {
        return defaultLabel;
    }
}
