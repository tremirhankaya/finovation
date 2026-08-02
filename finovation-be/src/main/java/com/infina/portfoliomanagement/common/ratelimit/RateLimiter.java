package com.infina.portfoliomanagement.common.ratelimit;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

@Component
@RequiredArgsConstructor
public class RateLimiter {

    private static final RedisScript<Long> INCREMENT_AND_EXPIRE_SCRIPT = RedisScript.of(
            """
            local current = redis.call('INCR', KEYS[1])
            if current == 1 then
                redis.call('EXPIRE', KEYS[1], ARGV[1])
            end
            return current
            """,
            Long.class
    );

    private final StringRedisTemplate redisTemplate;

    public long getAttempts(String key) {
        String value = redisTemplate.opsForValue().get(key);
        if (value == null) {
            return 0;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    public long increment(String key, Duration window) {
        Long attempts = redisTemplate.execute(
                INCREMENT_AND_EXPIRE_SCRIPT,
                List.of(key),
                String.valueOf(window.getSeconds())
        );
        return attempts == null ? 0 : attempts;
    }

    public void clear(String key) {
        redisTemplate.delete(key);
    }
}
