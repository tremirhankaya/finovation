package com.infina.portfoliomanagement.auth.service;

import com.infina.portfoliomanagement.security.jwt.JwtProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final String REDIS_KEY_PREFIX = "auth:refresh:";
    private static final int TOKEN_BYTE_LENGTH = 32;

    private final StringRedisTemplate stringRedisTemplate;
    private final JwtProperties jwtProperties;

    private final SecureRandom secureRandom = new SecureRandom();

    public String create(String username) {

        String rawToken = generateSecureToken();
        String tokenHash = hash(rawToken);

        String redisKey = buildRedisKey(tokenHash);
        Duration expiration = jwtProperties.refreshTokenExpiration();

        stringRedisTemplate.opsForValue()
                .set(
                        redisKey,
                        username,
                        expiration
                );

        return rawToken;
    }

    public String getUsername(String rawToken) {

        String tokenHash = hash(rawToken);
        String redisKey = buildRedisKey(tokenHash);

        return stringRedisTemplate.opsForValue()
                .get(redisKey);
    }

    public void revoke(String rawToken) {

        String tokenHash = hash(rawToken);
        String redisKey = buildRedisKey(tokenHash);

        stringRedisTemplate.delete(redisKey);
    }

    private String generateSecureToken() {

        byte[] randomBytes = new byte[TOKEN_BYTE_LENGTH];
        secureRandom.nextBytes(randomBytes);

        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(randomBytes);
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
            throw new IllegalStateException(
                    "SHA-256 algorithm is not available",
                    exception
            );
        }
    }

    private String buildRedisKey(String tokenHash) {
        return REDIS_KEY_PREFIX + tokenHash;
    }
}