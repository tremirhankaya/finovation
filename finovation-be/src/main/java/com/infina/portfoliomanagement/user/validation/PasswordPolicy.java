package com.infina.portfoliomanagement.user.validation;

public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 72;

    public static final String REGEX =
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{"
                    + MIN_LENGTH + "," + MAX_LENGTH + "}$";

    public static final String MESSAGE =
            "Password must be 8-72 characters and include uppercase, lowercase, "
                    + "digit and special character.";

    private PasswordPolicy() {
    }
}
