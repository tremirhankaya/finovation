package com.infina.portfoliomanagement.security.jwt;

import com.infina.portfoliomanagement.security.userdetails.CustomUserDetails;
import com.infina.portfoliomanagement.user.enums.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final Instant NOW =
            Instant.now().truncatedTo(ChronoUnit.SECONDS);

    private static final Duration ACCESS_TOKEN_EXPIRATION =
            Duration.ofMinutes(15);

    private static final Duration REFRESH_TOKEN_EXPIRATION =
            Duration.ofHours(15);

    /*
     * HS256 için yeterince uzun, Base64 formatında test anahtarı.
     * Production secret kullanılmamalı.
     */
    private static final String SECRET =
            "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    private Clock clock;
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(NOW, ZoneOffset.UTC);

        JwtProperties jwtProperties = new JwtProperties(
                SECRET,
                ACCESS_TOKEN_EXPIRATION,
                REFRESH_TOKEN_EXPIRATION
        );

        jwtService = new JwtService(jwtProperties, clock);
    }

    @Test
    void generateAccessToken_validUser_createsValidAccessToken() {
        CustomUserDetails userDetails = activeUser(
                "user",
                NOW.minusSeconds(1)
        );

        String token = jwtService.generateAccessToken(userDetails);

        assertThat(token).isNotBlank();
        assertThat(jwtService.extractUsername(token)).isEqualTo("user");
        assertThat(jwtService.extractExpiration(token))
                .isEqualTo(NOW.plus(ACCESS_TOKEN_EXPIRATION));
        assertThat(jwtService.isAccessTokenValid(token, userDetails))
                .isTrue();
    }

    @Test
    void isAccessTokenValid_tokenBelongsToAnotherUser_returnsFalse() {
        CustomUserDetails tokenOwner = activeUser(
                "user",
                NOW.minusSeconds(1)
        );

        CustomUserDetails anotherUser = activeUser(
                "another-user",
                NOW.minusSeconds(1)
        );

        String token = jwtService.generateAccessToken(tokenOwner);

        assertThat(jwtService.isAccessTokenValid(token, anotherUser))
                .isFalse();
    }

    @Test
    void isAccessTokenValid_refreshTokenProvided_returnsFalse() {
        CustomUserDetails userDetails = activeUser(
                "user",
                NOW.minusSeconds(1)
        );

        String refreshToken =
                jwtService.generateRefreshToken(userDetails);

        assertThat(
                jwtService.isAccessTokenValid(
                        refreshToken,
                        userDetails
                )
        ).isFalse();

        assertThat(
                jwtService.isRefreshTokenValid(
                        refreshToken,
                        userDetails
                )
        ).isTrue();
    }

    @Test
    void isAccessTokenValid_expiredToken_returnsFalse() {
        CustomUserDetails userDetails = activeUser(
                "user",
                NOW.minusSeconds(1)
        );

        JwtProperties expiredTokenProperties = new JwtProperties(
                SECRET,
                Duration.ofSeconds(-1),
                REFRESH_TOKEN_EXPIRATION
        );

        JwtService expiredTokenService = new JwtService(
                expiredTokenProperties,
                clock
        );

        String expiredToken =
                expiredTokenService.generateAccessToken(userDetails);

        assertThat(
                jwtService.isAccessTokenValid(
                        expiredToken,
                        userDetails
                )
        ).isFalse();
    }

    @Test
    void isAccessTokenValid_disabledUser_returnsFalse() {
        CustomUserDetails disabledUser = new CustomUserDetails(
                "user",
                "password",
                Role.USER,
                false,
                NOW.minusSeconds(1)
        );

        String token = jwtService.generateAccessToken(disabledUser);

        assertThat(
                jwtService.isAccessTokenValid(
                        token,
                        disabledUser
                )
        ).isFalse();
    }

    @Test
    void isAccessTokenValid_tokenIssuedBeforeCredentialsChanged_returnsFalse() {
        CustomUserDetails userAtTokenCreation = activeUser(
                "user",
                NOW.minusSeconds(1)
        );

        String token =
                jwtService.generateAccessToken(userAtTokenCreation);

        CustomUserDetails userAfterPasswordChange = activeUser(
                "user",
                NOW.plusSeconds(1)
        );

        assertThat(
                jwtService.isAccessTokenValid(
                        token,
                        userAfterPasswordChange
                )
        ).isFalse();
    }

    @Test
    void isAccessTokenValid_malformedToken_returnsFalse() {
        CustomUserDetails userDetails = activeUser(
                "user",
                NOW.minusSeconds(1)
        );

        assertThat(
                jwtService.isAccessTokenValid(
                        "not-a-valid-jwt",
                        userDetails
                )
        ).isFalse();
    }

    private CustomUserDetails activeUser(
            String username,
            Instant credentialsChangedAt
    ) {
        return new CustomUserDetails(
                username,
                "password",
                Role.USER,
                true,
                credentialsChangedAt
        );
    }
}