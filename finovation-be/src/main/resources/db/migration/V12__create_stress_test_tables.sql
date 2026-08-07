CREATE TABLE dbo.stress_tests
(
    id                BIGINT IDENTITY (1,1) NOT NULL,
    public_id         UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT df_stress_tests_public_id DEFAULT NEWID(),
    fund_portfolio_id BIGINT NOT NULL,
    scenario_id       BIGINT NOT NULL,
    user_id           BIGINT NOT NULL,
    request_id        VARCHAR(100) NOT NULL,
    as_of_date        DATE NOT NULL,
    status            VARCHAR(20) NOT NULL,
    portfolio_impact  DECIMAL(18, 8) NULL,
    is_deleted        BIT NOT NULL
        CONSTRAINT df_stress_tests_is_deleted DEFAULT 0,
    created_at        DATETIME2(6) NOT NULL
        CONSTRAINT df_stress_tests_created_at DEFAULT SYSUTCDATETIME(),
    completed_at      DATETIME2(6) NULL,

    CONSTRAINT pk_stress_tests PRIMARY KEY (id),

    CONSTRAINT uk_stress_tests_public_id
        UNIQUE (public_id),

    CONSTRAINT uk_stress_tests_request_id
        UNIQUE (request_id),

    CONSTRAINT fk_stress_tests_fund_portfolio
        FOREIGN KEY (fund_portfolio_id)
            REFERENCES dbo.fund_portfolios (id),

    CONSTRAINT fk_stress_tests_scenario
        FOREIGN KEY (scenario_id)
            REFERENCES dbo.stress_scenarios (id),

    CONSTRAINT fk_stress_tests_user
        FOREIGN KEY (user_id)
            REFERENCES dbo.users (id),

    CONSTRAINT ck_stress_tests_status
        CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED'))
);

CREATE INDEX ix_stress_tests_user_id
    ON dbo.stress_tests (user_id);

CREATE INDEX ix_stress_tests_fund_portfolio_id
    ON dbo.stress_tests (fund_portfolio_id);

CREATE INDEX ix_stress_tests_scenario_id
    ON dbo.stress_tests (scenario_id);

CREATE INDEX ix_stress_tests_history
    ON dbo.stress_tests (user_id, status, is_deleted, created_at);


CREATE TABLE dbo.stress_test_position_snapshots
(
    id                     BIGINT IDENTITY (1,1) NOT NULL,
    stress_test_id         BIGINT NOT NULL,
    asset_id               BIGINT NOT NULL,
    asset_code             VARCHAR(50) NOT NULL,
    asset_type             VARCHAR(30) NOT NULL,
    weight                 DECIMAL(18, 8) NOT NULL,
    impact                 DECIMAL(18, 8) NULL,
    portfolio_contribution DECIMAL(18, 8) NULL,

    CONSTRAINT pk_stress_test_position_snapshots
        PRIMARY KEY (id),

    CONSTRAINT fk_stress_test_position_snapshots_test
        FOREIGN KEY (stress_test_id)
            REFERENCES dbo.stress_tests (id),

    CONSTRAINT fk_stress_test_position_snapshots_asset
        FOREIGN KEY (asset_id)
            REFERENCES dbo.assets (id),

    CONSTRAINT uk_stress_test_position_snapshots_test_asset
        UNIQUE (stress_test_id, asset_id)
);

CREATE INDEX ix_stress_test_position_snapshots_test_id
    ON dbo.stress_test_position_snapshots (stress_test_id);