-- Deactivate legacy scenarios after deterministic scenarios and paths are seeded.
UPDATE dbo.stress_scenarios
SET
    is_active = 0,
    updated_at = SYSUTCDATETIME()
WHERE code IN (
               'GLOBAL_CRISIS',
               'RATE_CUT_SHOCK'
    );
