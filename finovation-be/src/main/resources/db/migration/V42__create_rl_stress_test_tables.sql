CREATE TABLE dbo.rl_stress_tests
(
    id                     BIGINT IDENTITY (1,1) NOT NULL,
    public_id              UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT df_rl_stress_tests_public_id DEFAULT NEWID(),
    fund_portfolio_id      BIGINT NOT NULL,
    user_id                BIGINT NOT NULL,
    model                  VARCHAR(100) NOT NULL,
    scenario_code          VARCHAR(100) NOT NULL,
    scenario_start_date    DATE NULL,
    scenario_end_date      DATE NULL,
    trading_day_count      INT NULL,
    initial_nav            DECIMAL(19, 4) NOT NULL,
    final_nav              DECIMAL(19, 4) NULL,
    return_pct             DECIMAL(18, 8) NULL,
    passive_final_nav      DECIMAL(19, 4) NULL,
    passive_return_pct     DECIMAL(18, 8) NULL,
    outperformance_amount  DECIMAL(19, 4) NULL,
    outperformance_pct     DECIMAL(18, 8) NULL,
    total_commission       DECIMAL(19, 4) NULL,
    created_at             DATETIME2(6) NOT NULL
        CONSTRAINT df_rl_stress_tests_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_rl_stress_tests
        PRIMARY KEY (id),

    CONSTRAINT uk_rl_stress_tests_public_id
        UNIQUE (public_id),

    CONSTRAINT fk_rl_stress_tests_fund_portfolio
        FOREIGN KEY (fund_portfolio_id)
            REFERENCES dbo.fund_portfolios (id),

    CONSTRAINT fk_rl_stress_tests_user
        FOREIGN KEY (user_id)
            REFERENCES dbo.users (id)
);

CREATE INDEX ix_rl_stress_tests_user_id
    ON dbo.rl_stress_tests (user_id);

CREATE INDEX ix_rl_stress_tests_fund_portfolio_id
    ON dbo.rl_stress_tests (fund_portfolio_id);

CREATE INDEX ix_rl_stress_tests_created_at
    ON dbo.rl_stress_tests (created_at);


CREATE TABLE dbo.rl_stress_test_days
(
    id                BIGINT IDENTITY (1,1) NOT NULL,
    rl_stress_test_id BIGINT NOT NULL,
    day_number        INT NOT NULL,
    date              DATE NOT NULL,
    total_new_nav     DECIMAL(19, 4) NOT NULL,
    passive_nav       DECIMAL(19, 4) NOT NULL,

    CONSTRAINT pk_rl_stress_test_days
        PRIMARY KEY (id),

    CONSTRAINT fk_rl_stress_test_days_test
        FOREIGN KEY (rl_stress_test_id)
            REFERENCES dbo.rl_stress_tests (id),

    CONSTRAINT uk_rl_stress_test_days_test_day
        UNIQUE (rl_stress_test_id, day_number)
);

CREATE INDEX ix_rl_stress_test_days_test_id
    ON dbo.rl_stress_test_days (rl_stress_test_id);


CREATE TABLE dbo.rl_stress_test_day_weights
(
    id                    BIGINT IDENTITY (1,1) NOT NULL,
    rl_stress_test_day_id BIGINT NOT NULL,
    asset_code            VARCHAR(50) NOT NULL,
    weight                DECIMAL(18, 12) NOT NULL,

    CONSTRAINT pk_rl_stress_test_day_weights
        PRIMARY KEY (id),

    CONSTRAINT fk_rl_stress_test_day_weights_day
        FOREIGN KEY (rl_stress_test_day_id)
            REFERENCES dbo.rl_stress_test_days (id),

    CONSTRAINT uk_rl_stress_test_day_weights_day_asset
        UNIQUE (rl_stress_test_day_id, asset_code)
);

CREATE INDEX ix_rl_stress_test_day_weights_day_id
    ON dbo.rl_stress_test_day_weights (rl_stress_test_day_id);
