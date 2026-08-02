package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.auth.config.PasswordResetProperties;
import com.infina.portfoliomanagement.auth.dto.PasswordResetRequest;
import com.infina.portfoliomanagement.auth.dto.PasswordResetStartRequest;
import com.infina.portfoliomanagement.auth.dto.PasswordResetVerifyRequest;
import com.infina.portfoliomanagement.auth.dto.PasswordResetVerifyResponse;
import com.infina.portfoliomanagement.auth.security.PasswordResetTokenCodec;
import com.infina.portfoliomanagement.auth.store.PasswordResetStore;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.user.entity.User;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.infina.portfoliomanagement.auth.config.PasswordResetIpRateLimitProperties;
import com.infina.portfoliomanagement.auth.store.PasswordResetIpRateLimitStore;
import jakarta.servlet.http.HttpServletRequest;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    private static final Clock FIXED_CLOCK =
            Clock.fixed(Instant.parse("2026-08-01T10:00:00Z"), ZoneOffset.UTC);
    private static final String CLIENT_IP = "127.0.0.1";

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordResetStore passwordResetStore;
    @Mock
    private PasswordResetTokenCodec tokenCodec;
    @Mock
    private PasswordResetMailService mailService;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private PasswordResetIpRateLimitStore ipRateLimitStore;
    @Mock
    private HttpServletRequest httpServletRequest;
    @Mock
    private RefreshTokenService refreshTokenService;

    private PasswordResetService passwordResetService;
    private User user;

    @BeforeEach
    void setUp() {
        PasswordResetProperties properties = new PasswordResetProperties(
                "test-secret",
                "no-reply@finovation.local",
                Duration.ofMinutes(10),
                Duration.ofMinutes(10),
                Duration.ofMinutes(1),
                5
        );

        PasswordResetIpRateLimitProperties ipRateLimitProperties = new PasswordResetIpRateLimitProperties(
                Duration.ofMinutes(1),
                5,
                Duration.ofMinutes(1),
                10
        );

        passwordResetService = new PasswordResetService(
                userRepository,
                passwordResetStore,
                tokenCodec,
                mailService,
                properties,
                passwordEncoder,
                FIXED_CLOCK,
                ipRateLimitStore,
                ipRateLimitProperties,
                httpServletRequest,
                refreshTokenService
        );

        lenient().when(httpServletRequest.getRemoteAddr()).thenReturn(CLIENT_IP);
        lenient().when(ipRateLimitStore.recordRequestAttempt(anyString())).thenReturn(1L);
        lenient().when(ipRateLimitStore.recordVerifyAttempt(anyString())).thenReturn(1L);

        user = User.builder()
                .id(7L)
                .username("reset.user")
                .email("user@example.com")
                .password("old-password")
                .passwordChangeRequired(true)
                .build();
    }

    @Test
    void requestOtp_unknownEmail_throwsAccountNotFound() {
        when(userRepository.findByEmailIgnoreCase("missing@example.com"))
                .thenReturn(Optional.empty());

        assertError(
                () -> passwordResetService.requestOtp(
                        new PasswordResetStartRequest("missing@example.com")
                ),
                ErrorCode.PASSWORD_RESET_ACCOUNT_NOT_FOUND
        );

        verifyNoInteractions(passwordResetStore, mailService);
    }

    @Test
    void requestOtp_duringCooldown_isRejected() {
        stubUserAndIdentity();
        when(passwordResetStore.reserveRequest("email-identity")).thenReturn(false);

        assertError(
                () -> passwordResetService.requestOtp(
                        new PasswordResetStartRequest("USER@example.com")
                ),
                ErrorCode.PASSWORD_RESET_REQUEST_TOO_SOON
        );

        verifyNoInteractions(mailService);
    }

    @Test
    void requestOtp_validAccount_savesHashedOtpAndSendsSixDigitCode() {
        stubUserAndIdentity();
        when(passwordResetStore.reserveRequest("email-identity")).thenReturn(true);
        when(tokenCodec.encode(argThat(value -> value.startsWith("otp:email-identity:"))))
                .thenReturn("otp-hash");

        passwordResetService.requestOtp(new PasswordResetStartRequest(" USER@example.com "));

        verify(passwordResetStore).saveOtp("email-identity", "otp-hash");
        verify(mailService).sendOtp(
                eq("user@example.com"),
                argThat(code -> code.matches("\\d{6}"))
        );
    }

    @Test
    void requestOtp_mailFailure_clearsReservedRequest() {
        stubUserAndIdentity();
        when(passwordResetStore.reserveRequest("email-identity")).thenReturn(true);
        when(tokenCodec.encode(argThat(value -> value.startsWith("otp:email-identity:"))))
                .thenReturn("otp-hash");
        org.mockito.Mockito.doThrow(new MailSendException("SMTP unavailable"))
                .when(mailService).sendOtp(eq("user@example.com"), anyString());

        assertError(
                () -> passwordResetService.requestOtp(
                        new PasswordResetStartRequest("user@example.com")
                ),
                ErrorCode.PASSWORD_RESET_MAIL_DELIVERY_FAILED
        );

        verify(passwordResetStore).clearRequest("email-identity");
    }

    @Test
    void verifyOtp_missingOtp_throwsExpired() {
        stubUserAndIdentity();
        when(passwordResetStore.getOtpHash("email-identity")).thenReturn(null);

        assertError(
                () -> passwordResetService.verifyOtp(
                        new PasswordResetVerifyRequest("user@example.com", "123456")
                ),
                ErrorCode.PASSWORD_RESET_OTP_EXPIRED
        );
    }

    @Test
    void verifyOtp_invalidOtp_recordsFailedAttempt() {
        stubVerification("stored-hash", "submitted-hash");
        when(passwordResetStore.recordFailedAttempt("email-identity")).thenReturn(1L);

        assertError(
                () -> passwordResetService.verifyOtp(
                        new PasswordResetVerifyRequest("user@example.com", "123456")
                ),
                ErrorCode.PASSWORD_RESET_OTP_INVALID
        );

        verify(passwordResetStore, never()).clearOtp("email-identity");
    }

    @Test
    void verifyOtp_atAttemptLimit_invalidatesOtp() {
        stubVerification("stored-hash", "submitted-hash");
        when(passwordResetStore.recordFailedAttempt("email-identity")).thenReturn(5L);

        assertError(
                () -> passwordResetService.verifyOtp(
                        new PasswordResetVerifyRequest("user@example.com", "123456")
                ),
                ErrorCode.PASSWORD_RESET_ATTEMPTS_EXCEEDED
        );

        verify(passwordResetStore).clearOtp("email-identity");
    }

    @Test
    void verifyOtp_validOtp_returnsAndStoresSingleUseResetToken() {
        stubVerification("same-hash", "same-hash");
        when(tokenCodec.encode(argThat(value -> value.startsWith("reset:"))))
                .thenReturn("reset-token-hash");

        PasswordResetVerifyResponse response = passwordResetService.verifyOtp(
                new PasswordResetVerifyRequest("user@example.com", "123456")
        );

        assertThat(response.resetToken()).isNotBlank();
        verify(passwordResetStore).clearOtp("email-identity");
        verify(passwordResetStore).saveResetToken("reset-token-hash", "reset.user");
    }

    @Test
    void requestOtp_ipRateLimitExceeded_throwsIpRateLimited() {
        when(ipRateLimitStore.recordRequestAttempt(CLIENT_IP)).thenReturn(6L);

        assertError(
                () -> passwordResetService.requestOtp(
                        new PasswordResetStartRequest("user@example.com")
                ),
                ErrorCode.PASSWORD_RESET_REQUEST_IP_RATE_LIMITED
        );

        verifyNoInteractions(userRepository, mailService);
    }

    @Test
    void verifyOtp_ipRateLimitExceeded_throwsIpRateLimited() {
        when(ipRateLimitStore.recordVerifyAttempt(CLIENT_IP)).thenReturn(11L);

        assertError(
                () -> passwordResetService.verifyOtp(
                        new PasswordResetVerifyRequest("user@example.com", "123456")
                ),
                ErrorCode.PASSWORD_RESET_VERIFY_IP_RATE_LIMITED
        );

        verifyNoInteractions(userRepository, passwordResetStore);
    }

    @Test
    void resetPassword_mismatchingPasswords_doesNotConsumeToken() {
        assertError(
                () -> passwordResetService.resetPassword(
                        new PasswordResetRequest("reset-token", "Password1!", "Different1!")
                ),
                ErrorCode.PASSWORD_RESET_PASSWORDS_DO_NOT_MATCH
        );

        verifyNoInteractions(passwordResetStore, passwordEncoder, refreshTokenService);
    }

    @Test
    void resetPassword_invalidOrConsumedToken_isRejected() {
        when(tokenCodec.encode("reset:reset-token")).thenReturn("reset-token-hash");
        when(passwordResetStore.consumeResetToken("reset-token-hash")).thenReturn(null);

        assertError(
                () -> passwordResetService.resetPassword(
                        new PasswordResetRequest("reset-token", "Password1!", "Password1!")
                ),
                ErrorCode.PASSWORD_RESET_TOKEN_INVALID_OR_EXPIRED
        );

        verifyNoInteractions(passwordEncoder, refreshTokenService);
    }

    @Test
    void resetPassword_validToken_updatesPasswordAndCompletesForcedChange() {
        when(tokenCodec.encode("reset:reset-token")).thenReturn("reset-token-hash");
        when(passwordResetStore.consumeResetToken("reset-token-hash")).thenReturn("reset.user");
        when(userRepository.findByUsername("reset.user")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("Password1!")).thenReturn("encoded-password");

        passwordResetService.resetPassword(
                new PasswordResetRequest("reset-token", "Password1!", "Password1!")
        );

        LocalDateTime expectedTimestamp = LocalDateTime.ofInstant(
                FIXED_CLOCK.instant(),
                ZoneOffset.UTC
        );

        assertThat(user.getPassword()).isEqualTo("encoded-password");
        assertThat(user.isPasswordChangeRequired()).isFalse();
        assertThat(user.getUpdatedAt()).isEqualTo(expectedTimestamp);
        assertThat(user.getCredentialsChangedAt()).isEqualTo(expectedTimestamp);
        verify(userRepository).save(user);
        verify(refreshTokenService).revokeAllForUser("reset.user");
    }

    private void stubUserAndIdentity() {
        when(userRepository.findByEmailIgnoreCase("user@example.com"))
                .thenReturn(Optional.of(user));
        when(tokenCodec.encode("email:user@example.com")).thenReturn("email-identity");
    }

    private void stubVerification(String storedHash, String submittedHash) {
        stubUserAndIdentity();
        when(passwordResetStore.getOtpHash("email-identity")).thenReturn(storedHash);
        when(tokenCodec.encode("otp:email-identity:123456")).thenReturn(submittedHash);
    }

    private void assertError(Runnable action, ErrorCode expectedErrorCode) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(expectedErrorCode);
    }
}
