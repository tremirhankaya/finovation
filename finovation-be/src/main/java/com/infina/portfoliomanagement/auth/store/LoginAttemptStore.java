package com.infina.portfoliomanagement.auth.store;

import com.infina.portfoliomanagement.auth.config.LoginRateLimitProperties;
import com.infina.portfoliomanagement.common.ratelimit.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class LoginAttemptStore {

    private static final String ATTEMPTS_PREFIX = "auth:login:attempts:";

    private final RateLimiter rateLimiter;
    private final LoginRateLimitProperties properties;

    public long getAttempts(String ip) {
        return rateLimiter.getAttempts(attemptsKey(ip));
    }

    public long recordFailedAttempt(String ip) {
        return rateLimiter.increment(attemptsKey(ip), properties.window());
    }

    public void clearAttempts(String ip) {
        rateLimiter.clear(attemptsKey(ip));
    }

    private String attemptsKey(String ip) {
        return ATTEMPTS_PREFIX + ip;
    }
}