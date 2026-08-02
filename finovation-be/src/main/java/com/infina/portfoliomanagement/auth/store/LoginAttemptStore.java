package com.infina.portfoliomanagement.auth.store;

import com.infina.portfoliomanagement.auth.config.LoginRateLimitProperties;
import com.infina.portfoliomanagement.common.ratelimit.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class LoginAttemptStore {

    private static final String IP_PREFIX = "auth:login:attempts:ip:";
    private static final String USERNAME_PREFIX = "auth:login:attempts:username:";

    private final RateLimiter rateLimiter;
    private final LoginRateLimitProperties properties;

    public long getIpAttempts(String ip) {
        return rateLimiter.getAttempts(ipKey(ip));
    }

    public long recordIpFailedAttempt(String ip) {
        return rateLimiter.increment(ipKey(ip), properties.window());
    }

    public void clearIpAttempts(String ip) {
        rateLimiter.clear(ipKey(ip));
    }

    public long getUsernameAttempts(String username) {
        return rateLimiter.getAttempts(usernameKey(username));
    }

    public long recordUsernameFailedAttempt(String username) {
        return rateLimiter.increment(usernameKey(username), properties.window());
    }

    public void clearUsernameAttempts(String username) {
        rateLimiter.clear(usernameKey(username));
    }

    private String ipKey(String ip) {
        return IP_PREFIX + ip;
    }

    private String usernameKey(String username) {
        return USERNAME_PREFIX + username;
    }
}
