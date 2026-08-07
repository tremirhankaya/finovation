ALTER TABLE dbo.optimization_requests
    DROP CONSTRAINT ck_optimization_requests_risk_level;

ALTER TABLE dbo.optimization_requests
    DROP CONSTRAINT ck_optimization_requests_liquidity_preference;

ALTER TABLE dbo.optimization_requests
    DROP COLUMN risk_level, liquidity_preference;

ALTER TABLE dbo.optimization_requests
    ADD risk_profile VARCHAR(15) NOT NULL
        CONSTRAINT ck_optimization_requests_risk_profile
            CHECK (risk_profile IN ('AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'))
        CONSTRAINT df_optimization_requests_risk_profile DEFAULT 'BALANCED';

ALTER TABLE dbo.optimization_requests
    DROP CONSTRAINT df_optimization_requests_risk_profile;
