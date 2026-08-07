ALTER TABLE dbo.optimization_requests
    DROP CONSTRAINT ck_optimization_requests_status;

ALTER TABLE dbo.optimization_requests
    ADD CONSTRAINT ck_optimization_requests_status
        CHECK (status IN ('PREPARING', 'RUNNING', 'COMPLETED', 'FAILED', 'APPROVED', 'REJECTED'));
