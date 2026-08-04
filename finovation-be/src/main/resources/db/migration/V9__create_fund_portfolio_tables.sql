CREATE TABLE dbo.model_runs
(
    id               BIGINT IDENTITY (1,1) NOT NULL,
    fund_draft_id    BIGINT NOT NULL,
    status           VARCHAR(30) NOT NULL,
    data_cutoff_date DATE NOT NULL,
    model_version    NVARCHAR(30) NULL,
    error_code       VARCHAR(50) NULL,
    error_message    NVARCHAR(500) NULL,
    started_at       DATETIME2(6) NULL,
    completed_at     DATETIME2(6) NULL,
    created_at       DATETIME2(6) NOT NULL
        CONSTRAINT df_model_runs_created_at DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2(6) NOT NULL
        CONSTRAINT df_model_runs_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_model_runs PRIMARY KEY (id),

    CONSTRAINT fk_model_runs_fund_draft
        FOREIGN KEY (fund_draft_id)
            REFERENCES dbo.fund_drafts (id),

    CONSTRAINT ck_model_runs_status
        CHECK (status IN ('VALIDATING_INPUTS', 'ANALYZING_SIGNALS', 'GENERATING_PROPOSALS',
                          'CHECKING_DIVERSITY', 'VALIDATING_PROPOSALS', 'COMPLETED',
                          'FAILED', 'CANCELLED', 'SUPERSEDED'))
);

CREATE INDEX ix_model_runs_fund_draft_id
    ON dbo.model_runs (fund_draft_id);

CREATE TABLE dbo.fund_portfolios
(
    id             BIGINT IDENTITY (1,1) NOT NULL,
    public_id      UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT df_fund_portfolios_public_id DEFAULT NEWID(),
    version        INT NOT NULL
        CONSTRAINT df_fund_portfolios_version DEFAULT 0,
    fund_draft_id  BIGINT NOT NULL,
    model_run_id   BIGINT NULL,
    portfolio_type VARCHAR(20) NOT NULL,
    proposal_rank  SMALLINT NULL,
    is_selected    BIT NOT NULL
        CONSTRAINT df_fund_portfolios_is_selected DEFAULT 0,
    label          NVARCHAR(100) NULL,
    created_at     DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_portfolios_created_at DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_portfolios_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_fund_portfolios PRIMARY KEY (id),
    CONSTRAINT uk_fund_portfolios_public_id UNIQUE (public_id),

    CONSTRAINT fk_fund_portfolios_fund_draft
        FOREIGN KEY (fund_draft_id)
            REFERENCES dbo.fund_drafts (id),

    CONSTRAINT fk_fund_portfolios_model_run
        FOREIGN KEY (model_run_id)
            REFERENCES dbo.model_runs (id),

    CONSTRAINT ck_fund_portfolios_type
        CHECK (portfolio_type IN ('PROPOSAL', 'WORKING')),

    CONSTRAINT ck_fund_portfolios_rank_presence
        CHECK ((portfolio_type = 'PROPOSAL' AND proposal_rank IS NOT NULL AND proposal_rank > 0)
            OR (portfolio_type = 'WORKING' AND proposal_rank IS NULL)),

    CONSTRAINT ck_fund_portfolios_model_run_presence
        CHECK ((portfolio_type = 'WORKING' AND model_run_id IS NULL)
            OR (portfolio_type = 'PROPOSAL' AND model_run_id IS NOT NULL))
);

CREATE INDEX ix_fund_portfolios_fund_draft_id
    ON dbo.fund_portfolios (fund_draft_id);

CREATE INDEX ix_fund_portfolios_model_run_id
    ON dbo.fund_portfolios (model_run_id);

CREATE UNIQUE INDEX uk_fund_portfolios_working
    ON dbo.fund_portfolios (fund_draft_id)
    WHERE portfolio_type = 'WORKING';

CREATE UNIQUE INDEX uk_fund_portfolios_run_rank
    ON dbo.fund_portfolios (model_run_id, proposal_rank)
    WHERE portfolio_type = 'PROPOSAL';

CREATE TABLE dbo.fund_positions
(
    id                BIGINT IDENTITY (1,1) NOT NULL,
    fund_portfolio_id BIGINT NOT NULL,
    asset_id          BIGINT NOT NULL,
    weight            DECIMAL(9, 6) NOT NULL,
    created_at        DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_positions_created_at DEFAULT SYSUTCDATETIME(),
    updated_at        DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_positions_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_fund_positions PRIMARY KEY (id),
    CONSTRAINT uk_fund_positions_portfolio_asset UNIQUE (fund_portfolio_id, asset_id),

    CONSTRAINT fk_fund_positions_portfolio
        FOREIGN KEY (fund_portfolio_id)
            REFERENCES dbo.fund_portfolios (id),

    CONSTRAINT fk_fund_positions_asset
        FOREIGN KEY (asset_id)
            REFERENCES dbo.assets (id),

    CONSTRAINT ck_fund_positions_weight
        CHECK (weight >= 0 AND weight <= 100)
);

CREATE INDEX ix_fund_positions_asset_id
    ON dbo.fund_positions (asset_id);
