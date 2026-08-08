package com.infina.portfoliomanagement.fund.dto;

import com.infina.portfoliomanagement.fund.enums.FundCurrency;

import java.util.Arrays;
import java.util.List;

public record FundCurrencyOption(
        String code,
        String label
) {
    public static FundCurrencyOption from(FundCurrency currency) {
        return new FundCurrencyOption(currency.getCode(), currency.getLabel());
    }

    public static List<FundCurrencyOption> all() {
        return Arrays.stream(FundCurrency.values()).map(FundCurrencyOption::from).toList();
    }
}
