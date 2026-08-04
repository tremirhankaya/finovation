CREATE TABLE dbo.fund_drafts
(
    id                     BIGINT IDENTITY (1,1) NOT NULL,
    public_id              UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT df_fund_drafts_public_id DEFAULT NEWID(),
    version                INT NOT NULL
        CONSTRAINT df_fund_drafts_version DEFAULT 0,
    name                   NVARCHAR(150) NULL,
    fund_type              VARCHAR(30) NOT NULL
        CONSTRAINT df_fund_drafts_fund_type DEFAULT 'EQUITY_INTENSIVE',
    currency_code          VARCHAR(3) NOT NULL
        CONSTRAINT df_fund_drafts_currency_code DEFAULT 'TRY',
    initial_portfolio_size DECIMAL(18, 2) NOT NULL,
    management_approach    VARCHAR(20) NULL,
    liquidity_target_pct   SMALLINT NULL,
    status                 VARCHAR(20) NOT NULL,
    created_by_user_id     BIGINT NOT NULL,
    created_at             DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_drafts_created_at DEFAULT SYSUTCDATETIME(),
    updated_at             DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_drafts_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_fund_drafts PRIMARY KEY (id),
    CONSTRAINT uk_fund_drafts_public_id UNIQUE (public_id),

    CONSTRAINT fk_fund_drafts_created_by_user
        FOREIGN KEY (created_by_user_id)
            REFERENCES dbo.users (id),

    CONSTRAINT ck_fund_drafts_fund_type
        CHECK (fund_type IN ('EQUITY_INTENSIVE')),

    CONSTRAINT ck_fund_drafts_currency_code
        CHECK (currency_code IN ('TRY')),

    CONSTRAINT ck_fund_drafts_status
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),

    CONSTRAINT ck_fund_drafts_management_approach
        CHECK (management_approach IN ('ATTACK', 'BALANCED', 'PROTECTIVE')),

    CONSTRAINT ck_fund_drafts_initial_portfolio_size
        CHECK (initial_portfolio_size > 0),

    CONSTRAINT ck_fund_drafts_liquidity_target_pct
        CHECK (liquidity_target_pct BETWEEN 5 AND 15)
);

CREATE INDEX ix_fund_drafts_created_by_user_id
    ON dbo.fund_drafts (created_by_user_id);

CREATE TABLE dbo.fund_constraints
(
    id               BIGINT IDENTITY (1,1) NOT NULL,
    fund_draft_id    BIGINT NOT NULL,
    constraint_code  VARCHAR(40) NOT NULL,
    constraint_value DECIMAL(9, 4) NOT NULL,
    source           VARCHAR(10) NOT NULL,
    created_at       DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_constraints_created_at DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_constraints_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_fund_constraints PRIMARY KEY (id),
    CONSTRAINT uk_fund_constraints_draft_code UNIQUE (fund_draft_id, constraint_code),

    CONSTRAINT fk_fund_constraints_draft
        FOREIGN KEY (fund_draft_id)
            REFERENCES dbo.fund_drafts (id),

    CONSTRAINT ck_fund_constraints_code
        CHECK (constraint_code IN ('EQUITY_MIN', 'SINGLE_STOCK_MAX', 'SECTOR_MAX', 'MIN_STOCK_COUNT')),

    CONSTRAINT ck_fund_constraints_source
        CHECK (source IN ('USER', 'PROFILE')),

    CONSTRAINT ck_fund_constraints_value
        CHECK (constraint_value >= 0)
);

CREATE TABLE dbo.fund_asset_exclusions
(
    fund_draft_id BIGINT NOT NULL,
    asset_id      BIGINT NOT NULL,
    created_at    DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_asset_exclusions_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_fund_asset_exclusions PRIMARY KEY (fund_draft_id, asset_id),

    CONSTRAINT fk_fund_asset_exclusions_draft
        FOREIGN KEY (fund_draft_id)
            REFERENCES dbo.fund_drafts (id),

    CONSTRAINT fk_fund_asset_exclusions_asset
        FOREIGN KEY (asset_id)
            REFERENCES dbo.assets (id)
);

CREATE INDEX ix_fund_asset_exclusions_asset_id
    ON dbo.fund_asset_exclusions (asset_id);
