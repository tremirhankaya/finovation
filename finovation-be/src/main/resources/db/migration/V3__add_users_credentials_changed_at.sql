ALTER TABLE dbo.users
    ADD credentials_changed_at DATETIME2(6) NOT NULL
        CONSTRAINT df_users_credentials_changed_at DEFAULT SYSUTCDATETIME();
