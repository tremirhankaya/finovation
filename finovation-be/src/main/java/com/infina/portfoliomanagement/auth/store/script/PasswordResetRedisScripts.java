package com.infina.portfoliomanagement.auth.store.script;

import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

@Component
public class PasswordResetRedisScripts {

    private static final String SCRIPT_PATH = "redis/password-reset/";

    private final RedisScript<Long> saveOtp = load("save-otp.lua", Long.class);
    private final RedisScript<Long> verifyAndConsumeOtp = load("verify-and-consume-otp.lua", Long.class);
    private final RedisScript<Long> saveResetToken = load("save-reset-token.lua", Long.class);
    private final RedisScript<String> consumeResetToken = load("consume-reset-token.lua", String.class);
    private final RedisScript<Long> revokeUserResetToken = load("revoke-user-reset-token.lua", Long.class);

    public RedisScript<Long> saveOtp() {
        return saveOtp;
    }

    public RedisScript<Long> verifyAndConsumeOtp() {
        return verifyAndConsumeOtp;
    }

    public RedisScript<Long> saveResetToken() {
        return saveResetToken;
    }

    public RedisScript<String> consumeResetToken() {
        return consumeResetToken;
    }

    public RedisScript<Long> revokeUserResetToken() {
        return revokeUserResetToken;
    }

    private <T> RedisScript<T> load(String filename, Class<T> resultType) {
        return RedisScript.of(
                new ClassPathResource(SCRIPT_PATH + filename),
                resultType
        );
    }
}
