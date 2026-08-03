local previousTokenHash = redis.call('GET', KEYS[1])
if previousTokenHash then
    redis.call('DEL', ARGV[1] .. previousTokenHash)
end

redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[4])
redis.call('SET', KEYS[1], ARGV[3], 'PX', ARGV[4])
return 1
