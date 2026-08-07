package com.infina.portfoliomanagement.fund.validation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FundNameRulesTest {

    @Test
    void rejectsNullBlankAndTooLong() {
        assertThat(FundNameRules.isValid(null)).isFalse();
        assertThat(FundNameRules.isValid("")).isFalse();
        assertThat(FundNameRules.isValid("   ")).isFalse();
        assertThat(FundNameRules.isValid("A".repeat(FundNameRules.MAX_LENGTH + 1))).isFalse();
    }

    @Test
    void rejectsDigitsAnywhere() {
        assertThat(FundNameRules.isValid("Fon 2")).isFalse();
        assertThat(FundNameRules.isValid("ABCDE1")).isFalse();
    }

    @Test
    void requiresMinimumLetterCount() {
        assertThat(FundNameRules.isValid("Fon")).isFalse();
        assertThat(FundNameRules.isValid("Fon A")).isFalse();
        assertThat(FundNameRules.isValid("Fonab")).isTrue();
    }

    @Test
    void acceptsTurkishLettersWithoutDigits() {
        assertThat(FundNameRules.isValid("Finovation Hisse Senedi Fonu")).isTrue();
        assertThat(FundNameRules.isValid("Örnek Fon Adı")).isTrue();
    }
}
