CREATE TABLE dbo.stress_scenarios
(
    id            BIGINT IDENTITY (1,1) NOT NULL,
    code          VARCHAR(50) NOT NULL,
    name          NVARCHAR(150) NOT NULL,
    description   NVARCHAR(500) NOT NULL,
    is_active     BIT NOT NULL
        CONSTRAINT df_stress_scenarios_is_active DEFAULT 1,
    display_order SMALLINT NOT NULL,
    created_at    DATETIME2(6) NOT NULL
        CONSTRAINT df_stress_scenarios_created_at DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2(6) NOT NULL
        CONSTRAINT df_stress_scenarios_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_stress_scenarios PRIMARY KEY (id),
    CONSTRAINT uk_stress_scenarios_code UNIQUE (code)
);