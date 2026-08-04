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
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final String REDIS_KEY_PREFIX = "auth:refresh:";
    private static final String REDIS_USER_KEY_PREFIX = "auth:refresh:user:";
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

        String userSetKey = buildUserSetKey(username);

        stringRedisTemplate.opsForSet().add(userSetKey, tokenHash);
        stringRedisTemplate.expire(userSetKey, expiration);

        return rawToken;
    }

    public String consume(String rawToken) {
        String tokenHash = hash(rawToken);
        String redisKey = buildRedisKey(tokenHash);

        String username = stringRedisTemplate.opsForValue()
                .getAndDelete(redisKey);

        if (username != null) {
            stringRedisTemplate.opsForSet()
                    .remove(buildUserSetKey(username), tokenHash);
        }

        return username;
    }

    public void revoke(String rawToken) {

        String tokenHash = hash(rawToken);
        String redisKey = buildRedisKey(tokenHash);

        String username = stringRedisTemplate.opsForValue().get(redisKey);

        stringRedisTemplate.delete(redisKey);

        if (username != null) {
            stringRedisTemplate.opsForSet()
                    .remove(buildUserSetKey(username), tokenHash);
        }
    }

    public void revokeAllForUser(String username) {

        String userSetKey = buildUserSetKey(username);
        Set<String> tokenHashes = stringRedisTemplate.opsForSet().members(userSetKey);

        if (tokenHashes != null && !tokenHashes.isEmpty()) {
            Set<String> redisKeys = tokenHashes.stream()
                    .map(this::buildRedisKey)
                    .collect(Collectors.toSet());

            stringRedisTemplate.delete(redisKeys);
        }

        stringRedisTemplate.delete(userSetKey);
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

    private String buildUserSetKey(String username) {
        return REDIS_USER_KEY_PREFIX + username;
    }
}
