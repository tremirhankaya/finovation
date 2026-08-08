package com.infina.portfoliomanagement.fund.validation;

public final class FundNameRules {

    public static final int MIN_LETTER_COUNT = 5;
    public static final int MAX_LENGTH = 150;

    private FundNameRules() {
    }

    public static boolean isValid(String name) {
        if (name == null) {
            return false;
        }

        String trimmed = name.trim();
        if (trimmed.isEmpty() || trimmed.length() > MAX_LENGTH) {
            return false;
        }

        int letterCount = 0;
        for (int i = 0; i < trimmed.length(); ) {
            int codePoint = trimmed.codePointAt(i);
            if (Character.isDigit(codePoint)) {
                return false;
            }
            if (Character.isLetter(codePoint)) {
                letterCount++;
            }
            i += Character.charCount(codePoint);
        }

        return letterCount >= MIN_LETTER_COUNT;
    }
}
