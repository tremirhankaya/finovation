ALTER TABLE dbo.companies
    ADD is_deleted BIT NOT NULL
        CONSTRAINT df_companies_is_deleted DEFAULT 0;
GO

ALTER TABLE dbo.companies DROP CONSTRAINT uk_companies_name;
GO

CREATE UNIQUE INDEX uk_companies_name_active
    ON dbo.companies (name)
    WHERE is_deleted = 0;

CREATE INDEX ix_companies_is_deleted
    ON dbo.companies (is_deleted);
GO
