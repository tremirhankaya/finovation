package com.infina.portfoliomanagement.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PasswordResetVerifyRequest(
        @NotBlank(message = "Email must not be blank.")
        @Email(message = "Email must be a valid email address.")
        @Size(max = 254, message = "Email must be at most 254 characters.")
        String email,

        @NotBlank(message = "Verification code must not be blank.")
        @Pattern(regexp = "\\d{6}", message = "Verification code must contain exactly 6 digits.")
        String code
) {
}
