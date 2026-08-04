local function constantTimeEquals(left, right)
    if string.len(left) ~= string.len(right) then
        return false
    end

    local difference = 0
    for index = 1, string.len(left) do
        difference = bit.bor(
            difference,
            bit.bxor(string.byte(left, index), string.byte(right, index))
        )
    end
    return difference == 0
end

local current = redis.call('GET', KEYS[1])
if not current then
    return 0
end

if constantTimeEquals(current, ARGV[1]) then
    redis.call('DEL', KEYS[1], KEYS[2])
    return 1
end

local attempts = redis.call('INCR', KEYS[2])
if attempts == 1 then
    local otpTtl = redis.call('PTTL', KEYS[1])
    if otpTtl > 0 then
        redis.call('PEXPIRE', KEYS[2], otpTtl)
    else
        redis.call('PEXPIRE', KEYS[2], ARGV[3])
    end
end

if attempts >= tonumber(ARGV[2]) then
    redis.call('DEL', KEYS[1], KEYS[2])
end

return -attempts
