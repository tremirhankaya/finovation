DROP INDEX ix_optimization_requests_fund_id
    ON dbo.optimization_requests;

ALTER TABLE dbo.optimization_requests
    DROP COLUMN fund_id;

ALTER TABLE dbo.optimization_requests
    ADD fund_id UNIQUEIDENTIFIER NOT NULL;

CREATE INDEX ix_optimization_requests_fund_id
    ON dbo.optimization_requests (fund_id);
