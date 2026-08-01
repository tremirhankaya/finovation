package com.infina.portfoliomanagement.auth.store;

import com.infina.portfoliomanagement.auth.config.RefreshRateLimitProperties;
import com.infina.portfoliomanagement.common.ratelimit.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RefreshRateLimitStore {

    private static final String ATTEMPTS_PREFIX = "auth:refresh:ip:";

    private final RateLimiter rateLimiter;
    private final RefreshRateLimitProperties properties;

    public long recordAttempt(String ip) {
        return rateLimiter.increment(ATTEMPTS_PREFIX + ip, properties.window());
    }
}