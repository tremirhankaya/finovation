CREATE TABLE dbo.sectors
(
    id          BIGINT IDENTITY (1,1) NOT NULL,
    sector_code NVARCHAR(20) NOT NULL,
    name        NVARCHAR(200) NOT NULL,
    created_at  DATETIME2(6) NOT NULL
        CONSTRAINT df_sectors_created_at DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2(6) NOT NULL
        CONSTRAINT df_sectors_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_sectors PRIMARY KEY (id),
    CONSTRAINT uk_sectors_sector_code UNIQUE (sector_code)
);

CREATE TABLE dbo.assets
(
    id                   BIGINT IDENTITY (1,1) NOT NULL,
    asset_code           NVARCHAR(50) NOT NULL,
    query_code           NVARCHAR(30) NULL,
    asset_type           VARCHAR(20) NOT NULL,
    display_name         NVARCHAR(200) NULL,
    currency_code        CHAR(3) NOT NULL
        CONSTRAINT df_assets_currency_code DEFAULT 'TRY',
    is_active            BIT NOT NULL
        CONSTRAINT df_assets_is_active DEFAULT 1,
    is_in_model_universe BIT NOT NULL
        CONSTRAINT df_assets_is_in_model_universe DEFAULT 0,
    created_at           DATETIME2(6) NOT NULL
        CONSTRAINT df_assets_created_at DEFAULT SYSUTCDATETIME(),
    updated_at           DATETIME2(6) NOT NULL
        CONSTRAINT df_assets_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_assets PRIMARY KEY (id),
    CONSTRAINT uk_assets_asset_code UNIQUE (asset_code),
    CONSTRAINT ck_assets_asset_type
        CHECK (asset_type IN ('EQUITY'))
);
