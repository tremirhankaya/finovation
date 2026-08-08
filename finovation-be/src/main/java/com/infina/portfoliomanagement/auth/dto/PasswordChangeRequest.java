package com.infina.portfoliomanagement.auth.dto;

import com.infina.portfoliomanagement.user.validation.PasswordPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record PasswordChangeRequest(
        @NotBlank(message = "New password must not be blank.")
        @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
        String newPassword,

        @NotBlank(message = "Password confirmation must not be blank.")
        String newPasswordConfirm
) {
}
