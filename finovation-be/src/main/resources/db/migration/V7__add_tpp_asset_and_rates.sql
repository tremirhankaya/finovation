ALTER TABLE dbo.assets
    DROP CONSTRAINT ck_assets_asset_type;
GO

ALTER TABLE dbo.assets
    ADD CONSTRAINT ck_assets_asset_type
        CHECK (asset_type IN ('EQUITY', 'TPP'));
GO

INSERT INTO dbo.assets (asset_code, query_code, asset_type, display_name, is_in_model_universe)
VALUES (N'TPP1G', N'1', 'TPP', N'TPP 1 Gün', 1);
GO

CREATE TABLE dbo.tpp_rates
(
    id                    BIGINT IDENTITY (1,1) NOT NULL,
    asset_id              BIGINT NOT NULL,
    data_date             DATE NOT NULL,
    maturity_date         DATE NULL,
    open_rate             DECIMAL(9, 4) NULL,
    high_rate             DECIMAL(9, 4) NULL,
    low_rate              DECIMAL(9, 4) NULL,
    close_rate            DECIMAL(9, 4) NULL,
    weighted_average_rate DECIMAL(9, 4) NOT NULL,
    trading_volume        DECIMAL(19, 2) NULL,
    transaction_count     INT NULL,
    created_at            DATETIME2(6) NOT NULL
        CONSTRAINT df_tpp_rates_created_at DEFAULT SYSUTCDATETIME(),
    updated_at            DATETIME2(6) NOT NULL
        CONSTRAINT df_tpp_rates_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_tpp_rates PRIMARY KEY (id),
    CONSTRAINT uk_tpp_rates_asset_date UNIQUE (asset_id, data_date),

    CONSTRAINT fk_tpp_rates_asset
        FOREIGN KEY (asset_id)
            REFERENCES dbo.assets (id)
);
GO
