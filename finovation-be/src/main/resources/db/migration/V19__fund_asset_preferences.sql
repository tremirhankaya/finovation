CREATE TABLE dbo.fund_asset_preferences
(
    id            BIGINT IDENTITY (1,1) NOT NULL,
    fund_draft_id BIGINT NOT NULL,
    asset_id      BIGINT NOT NULL,
    preference_type VARCHAR(20) NOT NULL,
    created_at    DATETIME2(6) NOT NULL
        CONSTRAINT df_fund_asset_preferences_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_fund_asset_preferences PRIMARY KEY (id),

    CONSTRAINT uk_fund_asset_preferences_draft_asset
        UNIQUE (fund_draft_id, asset_id),

    CONSTRAINT ck_fund_asset_preferences_type
        CHECK (preference_type IN ('INCLUDE', 'EXCLUDE')),

    CONSTRAINT fk_fund_asset_preferences_draft
        FOREIGN KEY (fund_draft_id)
            REFERENCES dbo.fund_drafts (id),

    CONSTRAINT fk_fund_asset_preferences_asset
        FOREIGN KEY (asset_id)
            REFERENCES dbo.assets (id)
);

CREATE INDEX ix_fund_asset_preferences_draft_id
    ON dbo.fund_asset_preferences (fund_draft_id);

CREATE INDEX ix_fund_asset_preferences_asset_id
    ON dbo.fund_asset_preferences (asset_id);

INSERT INTO dbo.fund_asset_preferences (fund_draft_id, asset_id, preference_type, created_at)
SELECT fund_draft_id, asset_id, 'EXCLUDE', created_at
FROM dbo.fund_asset_exclusions;

DROP TABLE dbo.fund_asset_exclusions;
