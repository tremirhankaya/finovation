package com.infina.portfoliomanagement.fundmonitoring.model;

import java.time.LocalDate;

public enum ComparisonPeriod {

    ONE_WEEK("1W"),
    ONE_MONTH("1M"),
    THREE_MONTHS("3M"),
    SIX_MONTHS("6M"),
    YEAR_TO_DATE("YTD"),
    ONE_YEAR("1Y"),
    THREE_YEARS("3Y"),
    FIVE_YEARS("5Y");

    private final String code;

    ComparisonPeriod(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public LocalDate startDate(LocalDate asOfDate) {
        return switch (this) {
            case ONE_WEEK -> asOfDate.minusWeeks(1);
            case ONE_MONTH -> asOfDate.minusMonths(1);
            case THREE_MONTHS -> asOfDate.minusMonths(3);
            case SIX_MONTHS -> asOfDate.minusMonths(6);
            case YEAR_TO_DATE -> asOfDate.withDayOfYear(1);
            case ONE_YEAR -> asOfDate.minusYears(1);
            case THREE_YEARS -> asOfDate.minusYears(3);
            case FIVE_YEARS -> asOfDate.minusYears(5);
        };
    }
}
