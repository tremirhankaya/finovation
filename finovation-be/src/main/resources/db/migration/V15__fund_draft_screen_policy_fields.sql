ALTER TABLE dbo.fund_drafts
    ADD horizon VARCHAR(5) NULL,
        tpp_min_pct SMALLINT NULL,
        tpp_max_pct SMALLINT NULL,
        preferred_tpp_pct SMALLINT NULL,
        min_stock_count SMALLINT NULL,
        max_stock_count SMALLINT NULL,
        equity_min_pct SMALLINT NULL,
        equity_max_pct SMALLINT NULL,
        single_stock_max_pct SMALLINT NULL;

ALTER TABLE dbo.fund_constraints
    DROP CONSTRAINT ck_fund_constraints_code;

ALTER TABLE dbo.fund_constraints
    ADD CONSTRAINT ck_fund_constraints_code
        CHECK (constraint_code IN (
            'EQUITY_MIN',
            'EQUITY_MAX',
            'SINGLE_STOCK_MAX',
            'SECTOR_MAX',
            'MIN_STOCK_COUNT',
            'MAX_STOCK_COUNT'
        ));
