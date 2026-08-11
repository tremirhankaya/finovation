package com.infina.portfoliomanagement.fund.enums;

public enum FundDraftSortField {

    NAME("name"),
    INITIAL_PORTFOLIO_SIZE("initialPortfolioSize"),
    CREATED_AT("createdAt"),
    UPDATED_AT("updatedAt");

    private final String property;

    FundDraftSortField(String property) {
        this.property = property;
    }

    public String getProperty() {
        return property;
    }
}
