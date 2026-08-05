CREATE TABLE dbo.optimization_requests
(
    id                   BIGINT IDENTITY (1,1) NOT NULL,
    fund_id              BIGINT NOT NULL,
    data_timestamp       DATETIME2(6) NULL,
    model_version        NVARCHAR(50) NULL,
    requested_by_user_id BIGINT NOT NULL,
    risk_level           VARCHAR(10) NOT NULL,
    liquidity_preference VARCHAR(10) NOT NULL,
    status               VARCHAR(20) NOT NULL,
    started_at           DATETIME2(6) NULL,
    completed_at         DATETIME2(6) NULL,
    error_message        NVARCHAR(1000) NULL,
    version              BIGINT NOT NULL
        CONSTRAINT df_optimization_requests_version DEFAULT 0,
    created_at           DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_requests_created_at DEFAULT SYSUTCDATETIME(),
    updated_at           DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_requests_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_optimization_requests PRIMARY KEY (id),

    CONSTRAINT fk_optimization_requests_requested_by
        FOREIGN KEY (requested_by_user_id)
            REFERENCES dbo.users (id),

    CONSTRAINT ck_optimization_requests_risk_level
        CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),

    CONSTRAINT ck_optimization_requests_liquidity_preference
        CHECK (liquidity_preference IN ('LOW', 'MEDIUM', 'HIGH')),

    CONSTRAINT ck_optimization_requests_status
        CHECK (status IN ('PREPARING', 'RUNNING', 'COMPLETED', 'FAILED', 'APPROVED', 'CANCELLED'))
);

CREATE INDEX ix_optimization_requests_fund_id
    ON dbo.optimization_requests (fund_id);

CREATE INDEX ix_optimization_requests_requested_by_user_id
    ON dbo.optimization_requests (requested_by_user_id);

CREATE TABLE dbo.optimization_request_constraint_targets
(
    id              BIGINT IDENTITY (1,1) NOT NULL,
    request_id      BIGINT NOT NULL,
    constraint_code VARCHAR(30) NOT NULL,
    min_value       DECIMAL(18, 6) NULL,
    max_value       DECIMAL(18, 6) NULL,
    created_at      DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_request_constraint_targets_created_at DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_request_constraint_targets_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_optimization_request_constraint_targets PRIMARY KEY (id),

    CONSTRAINT fk_optimization_request_constraint_targets_request
        FOREIGN KEY (request_id)
            REFERENCES dbo.optimization_requests (id),

    CONSTRAINT uk_optimization_request_constraint_targets_request_code
        UNIQUE (request_id, constraint_code),

    CONSTRAINT ck_optimization_request_constraint_targets_code
        CHECK (constraint_code IN (
            'EQUITY_WEIGHT_MIN', 'EQUITY_WEIGHT_MAX', 'TPP_MIN', 'TPP_MAX',
            'SINGLE_STOCK_MIN', 'SINGLE_STOCK_MAX', 'STOCK_COUNT_MIN', 'STOCK_COUNT_MAX',
            'SECTOR_MAX', 'CORRELATION_GROUP_MAX'
        )),

    CONSTRAINT ck_optimization_request_constraint_targets_min_max
        CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);

CREATE INDEX ix_optimization_request_constraint_targets_request_id
    ON dbo.optimization_request_constraint_targets (request_id);

CREATE TABLE dbo.optimization_asset_preferences
(
    id              BIGINT IDENTITY (1,1) NOT NULL,
    request_id      BIGINT NOT NULL,
    asset_code      NVARCHAR(20) NOT NULL,
    preference_type VARCHAR(20) NOT NULL,
    current_weight  DECIMAL(18, 6) NULL,
    fixed_weight    DECIMAL(18, 6) NULL,
    active          BIT NOT NULL
        CONSTRAINT df_optimization_asset_preferences_active DEFAULT 1,
    created_at      DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_asset_preferences_created_at DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_asset_preferences_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_optimization_asset_preferences PRIMARY KEY (id),

    CONSTRAINT fk_optimization_asset_preferences_request
        FOREIGN KEY (request_id)
            REFERENCES dbo.optimization_requests (id),

    CONSTRAINT uk_optimization_asset_preferences_request_asset
        UNIQUE (request_id, asset_code),

    CONSTRAINT ck_optimization_asset_preferences_type
        CHECK (preference_type IN ('KEEP', 'EXCLUDE', 'CANDIDATE_ADD', 'FORCE_ADD'))
);

CREATE INDEX ix_optimization_asset_preferences_request_id
    ON dbo.optimization_asset_preferences (request_id);

CREATE TABLE dbo.optimization_asset_limit_overrides
(
    id         BIGINT IDENTITY (1,1) NOT NULL,
    request_id BIGINT NOT NULL,
    asset_code NVARCHAR(20) NOT NULL,
    min_weight DECIMAL(18, 6) NULL,
    max_weight DECIMAL(18, 6) NULL,
    created_at DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_asset_limit_overrides_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_asset_limit_overrides_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_optimization_asset_limit_overrides PRIMARY KEY (id),

    CONSTRAINT fk_optimization_asset_limit_overrides_request
        FOREIGN KEY (request_id)
            REFERENCES dbo.optimization_requests (id),

    CONSTRAINT uk_optimization_asset_limit_overrides_request_asset
        UNIQUE (request_id, asset_code),

    CONSTRAINT ck_optimization_asset_limit_overrides_min_max
        CHECK (min_weight IS NULL OR max_weight IS NULL OR min_weight <= max_weight)
);

CREATE INDEX ix_optimization_asset_limit_overrides_request_id
    ON dbo.optimization_asset_limit_overrides (request_id);

CREATE TABLE dbo.optimization_constraint_checks
(
    id              BIGINT IDENTITY (1,1) NOT NULL,
    request_id      BIGINT NOT NULL,
    constraint_code VARCHAR(30) NOT NULL,
    actual_value    DECIMAL(18, 6) NOT NULL,
    min_limit       DECIMAL(18, 6) NULL,
    max_limit       DECIMAL(18, 6) NULL,
    status          VARCHAR(20) NOT NULL,
    created_at      DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_constraint_checks_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_optimization_constraint_checks PRIMARY KEY (id),

    CONSTRAINT fk_optimization_constraint_checks_request
        FOREIGN KEY (request_id)
            REFERENCES dbo.optimization_requests (id),

    CONSTRAINT ck_optimization_constraint_checks_code
        CHECK (constraint_code IN (
            'EQUITY_WEIGHT_MIN', 'EQUITY_WEIGHT_MAX', 'TPP_MIN', 'TPP_MAX',
            'SINGLE_STOCK_MIN', 'SINGLE_STOCK_MAX', 'STOCK_COUNT_MIN', 'STOCK_COUNT_MAX',
            'SECTOR_MAX', 'CORRELATION_GROUP_MAX'
        )),

    CONSTRAINT ck_optimization_constraint_checks_status
        CHECK (status IN ('COMPLIANT', 'NEAR_LIMIT', 'VIOLATED', 'UNVERIFIABLE'))
);

CREATE INDEX ix_optimization_constraint_checks_request_id
    ON dbo.optimization_constraint_checks (request_id);

CREATE TABLE dbo.optimization_results
(
    id           BIGINT IDENTITY (1,1) NOT NULL,
    request_id   BIGINT NOT NULL,
    generated_at DATETIME2(6) NOT NULL,
    created_at   DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_results_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_optimization_results PRIMARY KEY (id),

    CONSTRAINT fk_optimization_results_request
        FOREIGN KEY (request_id)
            REFERENCES dbo.optimization_requests (id)
);

CREATE INDEX ix_optimization_results_request_id
    ON dbo.optimization_results (request_id);

CREATE TABLE dbo.optimization_result_assets
(
    id                   BIGINT IDENTITY (1,1) NOT NULL,
    result_id            BIGINT NOT NULL,
    asset_code           NVARCHAR(20) NOT NULL,
    asset_type           VARCHAR(10) NOT NULL,
    current_weight       DECIMAL(18, 6) NOT NULL,
    proposed_weight      DECIMAL(18, 6) NOT NULL,
    final_weight         DECIMAL(18, 6) NULL,
    change_amount        DECIMAL(18, 6) NOT NULL,
    action_type          VARCHAR(20) NOT NULL,
    manually_overridden  BIT NOT NULL
        CONSTRAINT df_optimization_result_assets_manually_overridden DEFAULT 0,
    rationale            NVARCHAR(1000) NULL,
    created_at           DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_result_assets_created_at DEFAULT SYSUTCDATETIME(),
    updated_at           DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_result_assets_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_optimization_result_assets PRIMARY KEY (id),

    CONSTRAINT fk_optimization_result_assets_result
        FOREIGN KEY (result_id)
            REFERENCES dbo.optimization_results (id),

    CONSTRAINT uk_optimization_result_assets_result_asset
        UNIQUE (result_id, asset_code),

    CONSTRAINT ck_optimization_result_assets_asset_type
        CHECK (asset_type IN ('STOCK', 'TPP')),

    CONSTRAINT ck_optimization_result_assets_action_type
        CHECK (action_type IN ('INCREASE', 'DECREASE', 'KEEP'))
);

CREATE INDEX ix_optimization_result_assets_result_id
    ON dbo.optimization_result_assets (result_id);
