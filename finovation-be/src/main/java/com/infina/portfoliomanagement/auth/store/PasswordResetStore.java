package com.infina.portfoliomanagement.auth.store;

import com.infina.portfoliomanagement.auth.config.PasswordResetProperties;
import com.infina.portfoliomanagement.auth.store.model.OtpVerificationResult;
import com.infina.portfoliomanagement.auth.store.model.OtpVerificationStatus;
import com.infina.portfoliomanagement.auth.store.script.PasswordResetRedisScripts;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

@Component
@RequiredArgsConstructor
public class PasswordResetStore {

    private static final String OTP_PREFIX = "auth:password-reset:otp:";
    private static final String ATTEMPTS_PREFIX = "auth:password-reset:attempts:";
    private static final String COOLDOWN_PREFIX = "auth:password-reset:cooldown:";
    private static final String TOKEN_PREFIX = "auth:password-reset:token:";
    private static final String USER_TOKEN_PREFIX = "auth:password-reset:user:";

    private final StringRedisTemplate redisTemplate;
    private final PasswordResetProperties properties;
    private final PasswordResetRedisScripts scripts;

    public boolean reserveRequest(String identity) {
        return Boolean.TRUE.equals(redisTemplate.opsForValue().setIfAbsent(
                cooldownKey(identity),
                "1",
                properties.resendCooldown()
        ));
    }

    public void saveOtp(String identity, String otpHash) {
        redisTemplate.execute(
                scripts.saveOtp(),
                List.of(otpKey(identity), attemptsKey(identity)),
                otpHash,
                String.valueOf(expirationMillis(properties.otpExpiration()))
        );
    }

    public OtpVerificationResult verifyAndConsumeOtp(String identity, String submittedOtpHash) {
        Long result = redisTemplate.execute(
                scripts.verifyAndConsumeOtp(),
                List.of(otpKey(identity), attemptsKey(identity)),
                submittedOtpHash,
                String.valueOf(properties.maxAttempts()),
                String.valueOf(expirationMillis(properties.otpExpiration()))
        );

        if (result == null || result == 0) {
            return new OtpVerificationResult(OtpVerificationStatus.EXPIRED, 0);
        }
        if (result == 1) {
            return new OtpVerificationResult(OtpVerificationStatus.VERIFIED, 0);
        }

        long attempts = Math.abs(result);
        OtpVerificationStatus status = attempts >= properties.maxAttempts()
                ? OtpVerificationStatus.ATTEMPTS_EXCEEDED
                : OtpVerificationStatus.INVALID;
        return new OtpVerificationResult(status, attempts);
    }

    public void clearRequest(String identity) {
        redisTemplate.delete(List.of(
                otpKey(identity),
                attemptsKey(identity),
                cooldownKey(identity)
        ));
    }

    public void saveResetToken(String tokenHash, String username) {
        redisTemplate.execute(
                scripts.saveResetToken(),
                List.of(userTokenKey(username), tokenKey(tokenHash)),
                TOKEN_PREFIX,
                username,
                tokenHash,
                String.valueOf(expirationMillis(properties.resetTokenExpiration()))
        );
    }

    public String consumeResetToken(String tokenHash) {
        return redisTemplate.execute(
                scripts.consumeResetToken(),
                List.of(tokenKey(tokenHash)),
                USER_TOKEN_PREFIX,
                tokenHash
        );
    }

    public void revokeResetTokensForUser(String username) {
        redisTemplate.execute(
                scripts.revokeUserResetToken(),
                List.of(userTokenKey(username)),
                TOKEN_PREFIX
        );
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

    private String userTokenKey(String username) {
        return USER_TOKEN_PREFIX + username;
    }

    private long expirationMillis(Duration expiration) {
        return Math.max(1, expiration.toMillis());
    }

}
