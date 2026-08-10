ALTER TABLE dbo.optimization_requests
    ADD decided_by_user_id BIGINT NULL;

ALTER TABLE dbo.optimization_requests
    ADD CONSTRAINT fk_optimization_requests_decided_by
        FOREIGN KEY (decided_by_user_id)
            REFERENCES dbo.users (id);

CREATE INDEX ix_optimization_requests_decided_by_user_id
    ON dbo.optimization_requests (decided_by_user_id);
