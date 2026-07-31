ALTER TABLE dbo.users
    ADD is_deleted BIT NOT NULL
        CONSTRAINT df_users_is_deleted DEFAULT 0;
GO

ALTER TABLE dbo.users DROP CONSTRAINT uk_users_username;
ALTER TABLE dbo.users DROP CONSTRAINT uk_users_email;
GO

CREATE UNIQUE INDEX uk_users_username_active
    ON dbo.users (username)
    WHERE is_deleted = 0;

CREATE UNIQUE INDEX uk_users_email_active
    ON dbo.users (email)
    WHERE is_deleted = 0;

CREATE INDEX ix_users_is_deleted
    ON dbo.users (is_deleted);
GO
