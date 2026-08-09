package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.auth.config.PasswordResetIpRateLimitProperties;
import com.infina.portfoliomanagement.auth.config.PasswordResetProperties;
import com.infina.portfoliomanagement.auth.dto.PasswordResetRequest;
import com.infina.portfoliomanagement.auth.dto.PasswordResetStartRequest;
import com.infina.portfoliomanagement.auth.dto.PasswordResetVerifyRequest;
import com.infina.portfoliomanagement.auth.dto.PasswordResetVerifyResponse;
import com.infina.portfoliomanagement.auth.security.PasswordResetTokenCodec;
import com.infina.portfoliomanagement.auth.store.PasswordResetIpRateLimitStore;
import com.infina.portfoliomanagement.auth.store.PasswordResetStore;
import com.infina.portfoliomanagement.auth.store.model.OtpVerificationResult;
import com.infina.portfoliomanagement.auth.store.model.OtpVerificationStatus;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    private static final int OTP_BOUND = 1_000_000;
    private static final int RESET_TOKEN_BYTE_LENGTH = 32;

    private final UserRepository userRepository;
    private final PasswordResetStore passwordResetStore;
    private final PasswordResetTokenCodec tokenCodec;
    private final PasswordResetMailService mailService;
    private final PasswordResetProperties properties;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final PasswordResetIpRateLimitStore ipRateLimitStore;
    private final PasswordResetIpRateLimitProperties ipRateLimitProperties;
    private final HttpServletRequest httpServletRequest;
    private final RefreshTokenService refreshTokenService;

    private final SecureRandom secureRandom = new SecureRandom();

    @Transactional(readOnly = true)
    public void requestOtp(PasswordResetStartRequest request) {
        String clientIp = resolveClientIp();
        if (ipRateLimitStore.recordRequestAttempt(clientIp) > ipRateLimitProperties.requestMaxAttempts()) {
            throw new BaseException(ErrorCode.PASSWORD_RESET_REQUEST_IP_RATE_LIMITED);
        }

        String email = normalizeEmail(request.email());
        String identity = tokenCodec.encode("email:" + email);
        if (!passwordResetStore.reserveRequest(identity)) {
            throw new BaseException(ErrorCode.PASSWORD_RESET_REQUEST_TOO_SOON);
        }

        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (user == null) {
            log.warn("Password reset requested for an unknown account");
            return;
        }

        String otp = generateOtp();
        String otpHash = tokenCodec.encode("otp:" + identity + ":" + otp);
        passwordResetStore.saveOtp(identity, otpHash);

        try {
            mailService.sendOtp(user.getEmail(), otp);
        } catch (MailException exception) {
            passwordResetStore.clearRequest(identity);
            log.error("Password reset email delivery failed for userId={}", user.getId(), exception);
            throw new BaseException(ErrorCode.PASSWORD_RESET_MAIL_DELIVERY_FAILED);
        }

        log.info("Password reset OTP sent: userId={}", user.getId());
    }

    @Transactional(readOnly = true)
    public PasswordResetVerifyResponse verifyOtp(PasswordResetVerifyRequest request) {
        String clientIp = resolveClientIp();
        if (ipRateLimitStore.recordVerifyAttempt(clientIp) > ipRateLimitProperties.verifyMaxAttempts()) {
            throw new BaseException(ErrorCode.PASSWORD_RESET_VERIFY_IP_RATE_LIMITED);
        }

        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BaseException(
                        ErrorCode.PASSWORD_RESET_OTP_INVALID
                ));

        String identity = tokenCodec.encode("email:" + email);
        String submittedOtpHash = tokenCodec.encode(
                "otp:" + identity + ":" + request.code()
        );

        OtpVerificationResult verification =
                passwordResetStore.verifyAndConsumeOtp(identity, submittedOtpHash);

        if (verification.status() == OtpVerificationStatus.EXPIRED) {
            throw new BaseException(ErrorCode.PASSWORD_RESET_OTP_EXPIRED);
        }
        if (verification.status() == OtpVerificationStatus.INVALID) {
            log.warn(
                    "Invalid password reset OTP: userId={}, attempt={}",
                    user.getId(),
                    verification.attempts()
            );
            throw new BaseException(ErrorCode.PASSWORD_RESET_OTP_INVALID);
        }
        if (verification.status() == OtpVerificationStatus.ATTEMPTS_EXCEEDED) {
            log.warn(
                    "Password reset OTP attempts exceeded: userId={}, attempt={}",
                    user.getId(),
                    verification.attempts()
            );
            throw new BaseException(ErrorCode.PASSWORD_RESET_ATTEMPTS_EXCEEDED);
        }

        String resetToken = generateResetToken();
        String resetTokenHash = tokenCodec.encode("reset:" + resetToken);
        passwordResetStore.saveResetToken(resetTokenHash, user.getUsername());

        log.info("Password reset OTP verified: userId={}", user.getId());
        return new PasswordResetVerifyResponse(resetToken);
    }

    @Transactional
    public void resetPassword(PasswordResetRequest request) {
        if (!request.newPassword().equals(request.newPasswordConfirm())) {
            throw new BaseException(ErrorCode.PASSWORD_RESET_PASSWORDS_DO_NOT_MATCH);
        }

        String resetTokenHash = tokenCodec.encode("reset:" + request.resetToken());
        String username = passwordResetStore.consumeResetToken(resetTokenHash);
        if (username == null) {
            throw new BaseException(ErrorCode.PASSWORD_RESET_TOKEN_INVALID_OR_EXPIRED);
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new BaseException(ErrorCode.USER_NOT_FOUND));

        LocalDateTime now = LocalDateTime.now(clock);
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setPasswordChangeRequired(false);
        user.setUpdatedAt(now);
        user.setCredentialsChangedAt(now);
        userRepository.saveAndFlush(user);

        refreshTokenService.revokeAllForUser(user.getUsername());
        passwordResetStore.revokeResetTokensForUser(user.getUsername());

        log.info("Password reset completed: userId={}", user.getId());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String resolveClientIp() {
        return httpServletRequest.getRemoteAddr();
    }

    private String generateOtp() {
        return String.format(Locale.ROOT, "%06d", secureRandom.nextInt(OTP_BOUND));
    }

    private String generateResetToken() {
        byte[] bytes = new byte[RESET_TOKEN_BYTE_LENGTH];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

}
