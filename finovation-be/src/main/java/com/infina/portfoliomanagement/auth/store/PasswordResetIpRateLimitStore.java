package com.infina.portfoliomanagement.auth.store;

import com.infina.portfoliomanagement.auth.config.PasswordResetIpRateLimitProperties;
import com.infina.portfoliomanagement.common.ratelimit.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PasswordResetIpRateLimitStore {

    private static final String REQUEST_PREFIX = "auth:password-reset:ip:request:";
    private static final String VERIFY_PREFIX = "auth:password-reset:ip:verify:";

    private final RateLimiter rateLimiter;
    private final PasswordResetIpRateLimitProperties properties;

    public long recordRequestAttempt(String ip) {
        return rateLimiter.increment(REQUEST_PREFIX + ip, properties.requestWindow());
    }

    public long recordVerifyAttempt(String ip) {
        return rateLimiter.increment(VERIFY_PREFIX + ip, properties.verifyWindow());
    }
}