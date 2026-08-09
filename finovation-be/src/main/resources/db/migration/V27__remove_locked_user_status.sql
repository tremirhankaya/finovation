UPDATE dbo.users
SET status = 'INACTIVE',
    updated_at = SYSUTCDATETIME()
WHERE status = 'LOCKED';

ALTER TABLE dbo.users
    DROP CONSTRAINT ck_users_status;

ALTER TABLE dbo.users
    ADD CONSTRAINT ck_users_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'));
