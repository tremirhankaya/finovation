CREATE TABLE dbo.fund_design_profiles
(
    id                         BIGINT IDENTITY (1,1) NOT NULL,
    fund_type                  VARCHAR(30) NOT NULL,
    min_initial_portfolio_size DECIMAL(18, 2) NOT NULL,
    max_initial_portfolio_size DECIMAL(18, 2) NOT NULL,
    min_unit_price             DECIMAL(18, 4) NOT NULL,
    max_unit_price             DECIMAL(18, 4) NOT NULL,
    min_liquidity_target_pct   SMALLINT NOT NULL,
    max_liquidity_target_pct   SMALLINT NOT NULL,
    min_tpp_range_pct          SMALLINT NOT NULL,
    min_stock_count            SMALLINT NOT NULL,
    max_stock_count            SMALLINT NOT NULL,
    min_stock_count_range      SMALLINT NOT NULL,
    min_single_stock_max_pct   SMALLINT NOT NULL,
    max_single_stock_max_pct   SMALLINT NOT NULL,
    min_equity_weight_pct      SMALLINT NOT NULL,
    max_equity_weight_pct      SMALLINT NOT NULL,
    sector_max_pct             DECIMAL(9, 4) NOT NULL,
    created_at                 DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_design_profiles_created_at DEFAULT SYSUTCDATETIME(),
    updated_at                 DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_design_profiles_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_fund_design_profiles PRIMARY KEY (id),
    CONSTRAINT uk_fund_design_profiles_fund_type UNIQUE (fund_type),

    CONSTRAINT ck_fund_design_profiles_fund_type
        CHECK (fund_type IN ('EQUITY_INTENSIVE'))
);

INSERT INTO dbo.fund_design_profiles
(fund_type,
 min_initial_portfolio_size,
 max_initial_portfolio_size,
 min_unit_price,
 max_unit_price,
 min_liquidity_target_pct,
 max_liquidity_target_pct,
 min_tpp_range_pct,
 min_stock_count,
 max_stock_count,
 min_stock_count_range,
 min_single_stock_max_pct,
 max_single_stock_max_pct,
 min_equity_weight_pct,
 max_equity_weight_pct,
 sector_max_pct)
VALUES ('EQUITY_INTENSIVE',
        1000000.00,
        100000000000.00,
        1.0000,
        1000.0000,
        5,
        15,
        3,
        16,
        36,
        10,
        3,
        10,
        85,
        95,
        30.0000);

ALTER TABLE dbo.fund_drafts
    ADD unit_price DECIMAL(18, 4) NULL;
