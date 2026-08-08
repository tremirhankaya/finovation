package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.auth.dto.PasswordChangeRequest;
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
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthenticatedPasswordServiceTest {

    private static final Clock FIXED_CLOCK =
            Clock.fixed(Instant.parse("2026-08-08T10:00:00Z"), ZoneOffset.UTC);

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private RefreshTokenService refreshTokenService;
    @Mock
    private PasswordResetStore passwordResetStore;

    private AuthenticatedPasswordService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new AuthenticatedPasswordService(
                userRepository,
                passwordEncoder,
                refreshTokenService,
                passwordResetStore,
                FIXED_CLOCK
        );

        user = User.builder()
                .id(7L)
                .username("account.user")
                .password("encoded-current-password")
                .passwordChangeRequired(true)
                .build();
    }

    @Test
    void mismatchingNewPasswordsAreRejectedBeforeLoadingUser() {
        assertError(
                new PasswordChangeRequest("NewPassword1!", "Different1!"),
                ErrorCode.PASSWORD_RESET_PASSWORDS_DO_NOT_MATCH
        );

        verifyNoInteractions(userRepository, passwordEncoder, refreshTokenService, passwordResetStore);
    }

    @Test
    void currentPasswordCannotBeReused() {
        when(userRepository.findByUsername("account.user")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("CurrentPassword1!", "encoded-current-password"))
                .thenReturn(true);

        assertError(
                new PasswordChangeRequest("CurrentPassword1!", "CurrentPassword1!"),
                ErrorCode.PASSWORD_MUST_DIFFER_FROM_CURRENT
        );

        assertThat(user.getPassword()).isEqualTo("encoded-current-password");
        verifyNoInteractions(refreshTokenService, passwordResetStore);
    }

    @Test
    void validRequestUpdatesPasswordAndRevokesCredentials() {
        when(userRepository.findByUsername("account.user")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("NewPassword1!", "encoded-current-password"))
                .thenReturn(false);
        when(passwordEncoder.encode("NewPassword1!")).thenReturn("encoded-new-password");

        service.changePassword(
                "account.user",
                new PasswordChangeRequest("NewPassword1!", "NewPassword1!")
        );

        LocalDateTime expectedTimestamp = LocalDateTime.ofInstant(
                FIXED_CLOCK.instant(),
                ZoneOffset.UTC
        );
        assertThat(user.getPassword()).isEqualTo("encoded-new-password");
        assertThat(user.isPasswordChangeRequired()).isFalse();
        assertThat(user.getUpdatedAt()).isEqualTo(expectedTimestamp);
        assertThat(user.getCredentialsChangedAt()).isEqualTo(expectedTimestamp);
        verify(userRepository).saveAndFlush(user);
        verify(refreshTokenService).revokeAllForUser("account.user");
        verify(passwordResetStore).revokeResetTokensForUser("account.user");
    }

    private void assertError(PasswordChangeRequest request, ErrorCode expectedErrorCode) {
        assertThatThrownBy(() -> service.changePassword("account.user", request))
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(expectedErrorCode);
    }
}
