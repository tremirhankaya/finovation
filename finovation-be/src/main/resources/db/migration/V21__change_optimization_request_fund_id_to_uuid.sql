IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'ix_optimization_requests_fund_id'
      AND object_id = OBJECT_ID('dbo.optimization_requests')
)
    DROP INDEX ix_optimization_requests_fund_id
        ON dbo.optimization_requests;

ALTER TABLE dbo.optimization_requests
    DROP COLUMN fund_id;

ALTER TABLE dbo.optimization_requests
    ADD fund_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT df_optimization_requests_fund_id DEFAULT NEWID() WITH VALUES;

ALTER TABLE dbo.optimization_requests
    DROP CONSTRAINT df_optimization_requests_fund_id;

CREATE INDEX ix_optimization_requests_fund_id
    ON dbo.optimization_requests (fund_id);
