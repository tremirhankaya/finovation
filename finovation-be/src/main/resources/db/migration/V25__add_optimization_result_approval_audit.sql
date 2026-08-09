ALTER TABLE dbo.optimization_results
    ADD approved_by_user_id BIGINT NULL
        CONSTRAINT fk_optimization_results_approved_by
            REFERENCES dbo.users (id);

ALTER TABLE dbo.optimization_results
    ADD approved_at DATETIME2(6) NULL;
