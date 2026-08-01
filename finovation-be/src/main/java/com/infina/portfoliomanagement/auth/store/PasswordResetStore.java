package com.infina.portfoliomanagement.auth.store;

import com.infina.portfoliomanagement.auth.config.PasswordResetProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class PasswordResetStore {

    private static final String OTP_PREFIX = "auth:password-reset:otp:";
    private static final String ATTEMPTS_PREFIX = "auth:password-reset:attempts:";
    private static final String COOLDOWN_PREFIX = "auth:password-reset:cooldown:";
    private static final String TOKEN_PREFIX = "auth:password-reset:token:";

    private final StringRedisTemplate redisTemplate;
    private final PasswordResetProperties properties;

    public boolean reserveRequest(String identity) {
        return Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(
                cooldownKey(identity),
                "1",
                properties.resendCooldown()
        ));
    }

    public void saveOtp(String identity, String otpHash) {
        redisTemplate.opsForValue().set(otpKey(identity), otpHash, properties.otpExpiration());
        redisTemplate.opsForValue().set(attemptsKey(identity), "0", properties.otpExpiration());
    }

    public String getOtpHash(String identity) {
        return redisTemplate.opsForValue().get(otpKey(identity));
    }

    public long recordFailedAttempt(String identity) {
        Long attempts = redisTemplate.opsForValue().increment(attemptsKey(identity));
        if (attempts != null && attempts == 1) {
            redisTemplate.expire(attemptsKey(identity), properties.otpExpiration());
        }
        return attempts == null ? properties.maxAttempts() : attempts;
    }

    public void clearOtp(String identity) {
        redisTemplate.delete(List.of(otpKey(identity), attemptsKey(identity)));
    }

    public void clearRequest(String identity) {
        redisTemplate.delete(List.of(
                otpKey(identity),
                attemptsKey(identity),
                cooldownKey(identity)
        ));
    }

    public void saveResetToken(String tokenHash, String username) {
        redisTemplate.opsForValue().set(
                tokenKey(tokenHash),
                username,
                properties.resetTokenExpiration()
        );
    }

    public String consumeResetToken(String tokenHash) {
        return redisTemplate.opsForValue().getAndDelete(tokenKey(tokenHash));
    }

    private String otpKey(String identity) {
        return OTP_PREFIX + identity;
    }

    private String attemptsKey(String identity) {
        return ATTEMPTS_PREFIX + identity;
    }

    private String cooldownKey(String identity) {
        return COOLDOWN_PREFIX + identity;
    }

    private String tokenKey(String tokenHash) {
        return TOKEN_PREFIX + tokenHash;
    }
}
