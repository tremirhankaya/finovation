package com.infina.portfoliomanagement.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "auth.password-reset")
public record PasswordResetProperties(
        String secret,
        String sender,
        Duration otpExpiration,
        Duration resetTokenExpiration,
        Duration resendCooldown,
        int maxAttempts
) {
    public PasswordResetProperties {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("Password reset secret must not be blank.");
        }
        if (sender == null || sender.isBlank()) {
            throw new IllegalArgumentException("Password reset sender must not be blank.");
        }
        if (otpExpiration == null || otpExpiration.isNegative() || otpExpiration.isZero()) {
            throw new IllegalArgumentException("OTP expiration must be positive.");
        }
        if (resetTokenExpiration == null
                || resetTokenExpiration.isNegative()
                || resetTokenExpiration.isZero()) {
            throw new IllegalArgumentException("Reset token expiration must be positive.");
        }
        if (resendCooldown == null || resendCooldown.isNegative() || resendCooldown.isZero()) {
            throw new IllegalArgumentException("Resend cooldown must be positive.");
        }
        if (maxAttempts < 1) {
            throw new IllegalArgumentException("Maximum OTP attempts must be positive.");
        }
    }
}
