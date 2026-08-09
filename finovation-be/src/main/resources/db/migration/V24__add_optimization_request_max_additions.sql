ALTER TABLE dbo.optimization_requests
    ADD max_additions INT NOT NULL
        CONSTRAINT df_optimization_requests_max_additions DEFAULT 0;
GO

ALTER TABLE dbo.optimization_requests
    DROP CONSTRAINT df_optimization_requests_max_additions;
GO

ALTER TABLE dbo.optimization_requests
    ADD CONSTRAINT ck_optimization_requests_max_additions
        CHECK (max_additions BETWEEN 0 AND 30);
GO
