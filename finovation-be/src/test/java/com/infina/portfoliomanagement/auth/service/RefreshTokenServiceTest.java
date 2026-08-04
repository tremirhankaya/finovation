package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.security.jwt.JwtProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    private static final String RAW_TOKEN = "refresh-token";
    private static final String USERNAME = "user";

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private SetOperations<String, String> setOperations;

    private RefreshTokenService refreshTokenService;

    @BeforeEach
    void setUp() {
        JwtProperties jwtProperties = new JwtProperties(
                "test-secret",
                Duration.ofMinutes(15),
                Duration.ofHours(15)
        );

        refreshTokenService = new RefreshTokenService(
                stringRedisTemplate,
                jwtProperties
        );
    }

    @Test
    void consume_existingToken_returnsUsernameAndRemovesTokenFromUserIndex() {
        String tokenHash = hash(RAW_TOKEN);
        String tokenKey = "auth:refresh:" + tokenHash;
        String userSetKey = "auth:refresh:user:" + USERNAME;

        when(stringRedisTemplate.opsForValue())
                .thenReturn(valueOperations);
        when(stringRedisTemplate.opsForSet())
                .thenReturn(setOperations);
        when(valueOperations.getAndDelete(tokenKey))
                .thenReturn(USERNAME);

        String result = refreshTokenService.consume(RAW_TOKEN);

        assertThat(result).isEqualTo(USERNAME);

        verify(valueOperations).getAndDelete(tokenKey);
        verify(setOperations).remove(userSetKey, tokenHash);
        verify(stringRedisTemplate, never()).delete(tokenKey);
    }

    @Test
    void consume_unknownToken_returnsNullAndDoesNotModifyUserIndex() {
        String tokenHash = hash(RAW_TOKEN);
        String tokenKey = "auth:refresh:" + tokenHash;

        when(stringRedisTemplate.opsForValue())
                .thenReturn(valueOperations);
        when(valueOperations.getAndDelete(tokenKey))
                .thenReturn(null);

        String result = refreshTokenService.consume(RAW_TOKEN);

        assertThat(result).isNull();

        verify(valueOperations).getAndDelete(tokenKey);
        verify(stringRedisTemplate, never()).opsForSet();
        verify(stringRedisTemplate, never()).delete(tokenKey);
    }

    private String hash(String rawToken) {
        try {
            MessageDigest messageDigest =
                    MessageDigest.getInstance("SHA-256");

            byte[] hashBytes = messageDigest.digest(
                    rawToken.getBytes(StandardCharsets.UTF_8)
            );

            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(hashBytes);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}