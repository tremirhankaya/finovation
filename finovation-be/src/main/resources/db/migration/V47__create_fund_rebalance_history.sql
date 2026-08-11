CREATE TABLE dbo.fund_rebalances
(
    id                      BIGINT IDENTITY (1,1) NOT NULL,
    fund_draft_id           BIGINT NOT NULL,
    rebalance_type          VARCHAR(20) NOT NULL,
    effective_at            DATETIME2(6) NOT NULL,
    optimization_request_id BIGINT NULL,
    nav_at_rebalance        DECIMAL(28, 8) NOT NULL,
    created_at              DATETIME2(6) NOT NULL,

    CONSTRAINT pk_fund_rebalances PRIMARY KEY (id),
    CONSTRAINT fk_fund_rebalances_fund_draft
        FOREIGN KEY (fund_draft_id) REFERENCES dbo.fund_drafts (id),
    CONSTRAINT fk_fund_rebalances_optimization_request
        FOREIGN KEY (optimization_request_id) REFERENCES dbo.optimization_requests (id),
    CONSTRAINT ck_fund_rebalances_type
        CHECK (rebalance_type IN ('CREATION', 'OPTIMIZATION')),
    CONSTRAINT ck_fund_rebalances_nav_positive
        CHECK (nav_at_rebalance > 0)
);

CREATE UNIQUE INDEX ux_fund_rebalances_creation
    ON dbo.fund_rebalances (fund_draft_id, rebalance_type)
    WHERE rebalance_type = 'CREATION';

CREATE UNIQUE INDEX ux_fund_rebalances_optimization_request
    ON dbo.fund_rebalances (optimization_request_id)
    WHERE optimization_request_id IS NOT NULL;

CREATE INDEX ix_fund_rebalances_fund_effective
    ON dbo.fund_rebalances (fund_draft_id, effective_at, id);

CREATE TABLE dbo.fund_rebalance_positions
(
    id                BIGINT IDENTITY (1,1) NOT NULL,
    fund_rebalance_id BIGINT NOT NULL,
    asset_id          BIGINT NOT NULL,
    target_weight     DECIMAL(9, 6) NOT NULL,
    quantity          DECIMAL(28, 12) NOT NULL,
    execution_price   DECIMAL(28, 8) NOT NULL,

    CONSTRAINT pk_fund_rebalance_positions PRIMARY KEY (id),
    CONSTRAINT fk_fund_rebalance_positions_rebalance
        FOREIGN KEY (fund_rebalance_id) REFERENCES dbo.fund_rebalances (id) ON DELETE CASCADE,
    CONSTRAINT fk_fund_rebalance_positions_asset
        FOREIGN KEY (asset_id) REFERENCES dbo.assets (id),
    CONSTRAINT uk_fund_rebalance_positions_asset
        UNIQUE (fund_rebalance_id, asset_id),
    CONSTRAINT ck_fund_rebalance_positions_weight
        CHECK (target_weight > 0 AND target_weight <= 100),
    CONSTRAINT ck_fund_rebalance_positions_quantity
        CHECK (quantity > 0),
    CONSTRAINT ck_fund_rebalance_positions_price
        CHECK (execution_price > 0)
);

CREATE INDEX ix_fund_rebalance_positions_asset
    ON dbo.fund_rebalance_positions (asset_id);
