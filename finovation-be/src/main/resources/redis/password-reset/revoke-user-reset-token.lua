local tokenHash = redis.call('GET', KEYS[1])
if tokenHash then
    redis.call('DEL', ARGV[1] .. tokenHash)
end
redis.call('DEL', KEYS[1])
return tokenHash and 1 or 0
