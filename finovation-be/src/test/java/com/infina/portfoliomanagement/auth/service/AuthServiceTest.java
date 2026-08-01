package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.auth.config.LoginRateLimitProperties;
import com.infina.portfoliomanagement.auth.dto.LoginRequest;
import com.infina.portfoliomanagement.auth.dto.LoginResponse;
import com.infina.portfoliomanagement.auth.store.LoginAttemptStore;
import com.infina.portfoliomanagement.common.exception.BaseException;
import com.infina.portfoliomanagement.common.exception.ErrorCode;
import com.infina.portfoliomanagement.security.jwt.JwtService;
import com.infina.portfoliomanagement.security.userdetails.CustomUserDetailsService;
import com.infina.portfoliomanagement.user.policy.RolePolicy;
import com.infina.portfoliomanagement.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String CLIENT_IP = "127.0.0.1";

    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private JwtService jwtService;
    @Mock
    private CustomUserDetailsService customUserDetailsService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RolePolicy rolePolicy;
    @Mock
    private RefreshTokenService refreshTokenService;
    @Mock
    private LoginAttemptStore loginAttemptStore;
    @Mock
    private HttpServletRequest httpServletRequest;
    @Mock
    private Authentication authentication;
    @Mock
    private UserDetails userDetails;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        LoginRateLimitProperties properties = new LoginRateLimitProperties(
                Duration.ofMinutes(1),
                5
        );

        authService = new AuthService(
                authenticationManager,
                jwtService,
                customUserDetailsService,
                userRepository,
                rolePolicy,
                refreshTokenService,
                loginAttemptStore,
                properties,
                httpServletRequest
        );

        when(httpServletRequest.getRemoteAddr()).thenReturn(CLIENT_IP);
    }

    @Test
    void login_attemptsExceeded_throwsRateLimitError() {
        when(loginAttemptStore.getAttempts(CLIENT_IP)).thenReturn(5L);

        assertError(
                () -> authService.login(new LoginRequest("user", "password")),
                ErrorCode.LOGIN_ATTEMPTS_EXCEEDED
        );

        verifyNoInteractions(authenticationManager);
    }

    @Test
    void login_successfulCredentials_clearsAttemptsAndReturnsTokens() {
        when(loginAttemptStore.getAttempts(CLIENT_IP)).thenReturn(0L);
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(authentication.getPrincipal()).thenReturn(userDetails);
        when(userDetails.getUsername()).thenReturn("user");
        when(jwtService.generateAccessToken(userDetails)).thenReturn("access-token");
        when(refreshTokenService.create("user")).thenReturn("refresh-token");

        LoginResponse response = authService.login(new LoginRequest("user", "password"));

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isEqualTo("refresh-token");
        verify(loginAttemptStore).clearAttempts(CLIENT_IP);
        verify(loginAttemptStore, never()).recordFailedAttempt(CLIENT_IP);
    }

    @Test
    void login_invalidCredentials_recordsFailedAttempt() {
        when(loginAttemptStore.getAttempts(CLIENT_IP)).thenReturn(0L);
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("bad credentials"));

        assertError(
                () -> authService.login(new LoginRequest("user", "wrong-password")),
                ErrorCode.INVALID_CREDENTIALS
        );

        verify(loginAttemptStore).recordFailedAttempt(CLIENT_IP);
        verify(loginAttemptStore, never()).clearAttempts(CLIENT_IP);
    }

    private void assertError(Runnable action, ErrorCode expectedErrorCode) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BaseException.class)
                .extracting(exception -> ((BaseException) exception).getErrorCode())
                .isEqualTo(expectedErrorCode);
    }
}
