local username = redis.call('GET', KEYS[1])
if not username then
    return nil
end

redis.call('DEL', KEYS[1])
local userTokenKey = ARGV[1] .. username
if redis.call('GET', userTokenKey) == ARGV[2] then
    redis.call('DEL', userTokenKey)
end
return username
