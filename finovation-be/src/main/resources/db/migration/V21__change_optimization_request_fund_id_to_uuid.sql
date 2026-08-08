DELETE FROM dbo.optimization_result_assets
WHERE result_id IN (SELECT id FROM dbo.optimization_results);

DELETE FROM dbo.optimization_results;

DELETE FROM dbo.optimization_constraint_checks;

DELETE FROM dbo.optimization_asset_limit_overrides;

DELETE FROM dbo.optimization_asset_preferences;

DELETE FROM dbo.optimization_request_constraint_targets;

DELETE FROM dbo.optimization_requests;

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
    ADD fund_id UNIQUEIDENTIFIER NOT NULL;

CREATE INDEX ix_optimization_requests_fund_id
    ON dbo.optimization_requests (fund_id);
