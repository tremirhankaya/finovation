CREATE TABLE dbo.equity_details
(
    asset_id      BIGINT NOT NULL,
    sector_id     BIGINT NULL,
    company_name  NVARCHAR(200) NOT NULL,
    security_type NVARCHAR(30) NULL,
    vendor_code   NVARCHAR(30) NULL,
    issuer_code   NVARCHAR(20) NULL,
    isin_code     NVARCHAR(12) NULL,
    legacy_code   NVARCHAR(60) NULL,
    market_code   NVARCHAR(20) NULL,
    created_at    DATETIME2(6) NOT NULL
        CONSTRAINT df_equity_details_created_at DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2(6) NOT NULL
        CONSTRAINT df_equity_details_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_equity_details PRIMARY KEY (asset_id),

    CONSTRAINT fk_equity_details_asset
        FOREIGN KEY (asset_id)
            REFERENCES dbo.assets (id),

    CONSTRAINT fk_equity_details_sector
        FOREIGN KEY (sector_id)
            REFERENCES dbo.sectors (id)
);

CREATE INDEX ix_equity_details_sector_id
    ON dbo.equity_details (sector_id);

CREATE TABLE dbo.equity_prices
(
    id                 BIGINT IDENTITY (1,1) NOT NULL,
    asset_id           BIGINT NOT NULL,
    data_date          DATE NOT NULL,
    open_price         DECIMAL(19, 6) NULL,
    high_price         DECIMAL(19, 6) NULL,
    low_price          DECIMAL(19, 6) NULL,
    close_price        DECIMAL(19, 6) NOT NULL,
    source_record_date DATETIME2(6) NULL,
    created_at         DATETIME2(6) NOT NULL
        CONSTRAINT df_equity_prices_created_at DEFAULT SYSUTCDATETIME(),
    updated_at         DATETIME2(6) NOT NULL
        CONSTRAINT df_equity_prices_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_equity_prices PRIMARY KEY (id),
    CONSTRAINT uk_equity_prices_asset_date UNIQUE (asset_id, data_date),

    CONSTRAINT fk_equity_prices_asset
        FOREIGN KEY (asset_id)
            REFERENCES dbo.assets (id)
);

CREATE TABLE dbo.equity_price_revisions
(
    id                     BIGINT IDENTITY (1,1) NOT NULL,
    asset_id               BIGINT NOT NULL,
    data_date              DATE NOT NULL,
    old_close_price        DECIMAL(19, 6) NOT NULL,
    new_close_price        DECIMAL(19, 6) NOT NULL,
    old_source_record_date DATETIME2(6) NULL,
    new_source_record_date DATETIME2(6) NULL,
    detected_at            DATETIME2(6) NOT NULL
        CONSTRAINT df_equity_price_revisions_detected_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_equity_price_revisions PRIMARY KEY (id),

    CONSTRAINT fk_equity_price_revisions_asset
        FOREIGN KEY (asset_id)
            REFERENCES dbo.assets (id)
);

CREATE INDEX ix_equity_price_revisions_asset_data_date
    ON dbo.equity_price_revisions (asset_id, data_date);

CREATE INDEX ix_equity_price_revisions_detected_at
    ON dbo.equity_price_revisions (detected_at);
