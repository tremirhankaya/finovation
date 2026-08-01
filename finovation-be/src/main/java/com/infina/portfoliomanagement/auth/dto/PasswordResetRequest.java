package com.infina.portfoliomanagement.auth.dto;

import com.infina.portfoliomanagement.user.validation.PasswordPolicy;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PasswordResetRequest(
        @NotBlank(message = "Reset token must not be blank.")
        @Size(max = 256, message = "Reset token must be at most 256 characters.")
        String resetToken,

        @NotBlank(message = "New password must not be blank.")
        @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE)
        String newPassword,

        @NotBlank(message = "Password confirmation must not be blank.")
        String newPasswordConfirm
) {
}
