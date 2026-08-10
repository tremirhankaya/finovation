ALTER TABLE dbo.stress_scenarios
    ADD horizon_days SMALLINT NULL;

CREATE TABLE dbo.stress_scenario_asset_shocks
(
    id          BIGINT IDENTITY (1,1) NOT NULL,
    scenario_id BIGINT NOT NULL,
    asset_id    BIGINT NOT NULL,
    impact      DECIMAL(20, 12) NOT NULL,
    created_at  DATETIME2(6) NOT NULL
        CONSTRAINT df_stress_scenario_asset_shocks_created_at
            DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2(6) NOT NULL
        CONSTRAINT df_stress_scenario_asset_shocks_updated_at
            DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_stress_scenario_asset_shocks
        PRIMARY KEY (id),

    CONSTRAINT fk_stress_scenario_asset_shocks_scenario
        FOREIGN KEY (scenario_id)
            REFERENCES dbo.stress_scenarios (id),

    CONSTRAINT fk_stress_scenario_asset_shocks_asset
        FOREIGN KEY (asset_id)
            REFERENCES dbo.assets (id),

    CONSTRAINT uk_stress_scenario_asset_shocks_scenario_asset
        UNIQUE (scenario_id, asset_id)
);

CREATE INDEX ix_stress_scenario_asset_shocks_scenario_id
    ON dbo.stress_scenario_asset_shocks (scenario_id);

CREATE INDEX ix_stress_scenario_asset_shocks_asset_id
    ON dbo.stress_scenario_asset_shocks (asset_id);


CREATE TABLE dbo.stress_scenario_asset_paths
(
    id          BIGINT IDENTITY (1,1) NOT NULL,
    scenario_id BIGINT NOT NULL,
    asset_id    BIGINT NOT NULL,
    path_date   DATE NOT NULL,
    day_index   SMALLINT NOT NULL,
    close_value DECIMAL(20, 8) NOT NULL,
    impact      DECIMAL(20, 12) NOT NULL,

    CONSTRAINT pk_stress_scenario_asset_paths
        PRIMARY KEY (id),

    CONSTRAINT fk_stress_scenario_asset_paths_scenario
        FOREIGN KEY (scenario_id)
            REFERENCES dbo.stress_scenarios (id),

    CONSTRAINT fk_stress_scenario_asset_paths_asset
        FOREIGN KEY (asset_id)
            REFERENCES dbo.assets (id),

    CONSTRAINT uk_stress_scenario_asset_paths_scenario_asset_day
        UNIQUE (scenario_id, asset_id, day_index)
);

CREATE INDEX ix_stress_scenario_asset_paths_scenario_id
    ON dbo.stress_scenario_asset_paths (scenario_id);

CREATE INDEX ix_stress_scenario_asset_paths_asset_id
    ON dbo.stress_scenario_asset_paths (asset_id);

CREATE INDEX ix_stress_scenario_asset_paths_scenario_date
    ON dbo.stress_scenario_asset_paths (scenario_id, path_date);
