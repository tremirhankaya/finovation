CREATE TABLE dbo.optimization_result_metrics
(
    id             BIGINT IDENTITY (1,1) NOT NULL,
    result_id      BIGINT NOT NULL,
    metric_key     VARCHAR(30) NOT NULL,
    current_value  DECIMAL(18, 6) NULL,
    proposed_value DECIMAL(18, 6) NULL,
    created_at     DATETIME2(6) NOT NULL
        CONSTRAINT df_optimization_result_metrics_created_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_optimization_result_metrics PRIMARY KEY (id),

    CONSTRAINT fk_optimization_result_metrics_result
        FOREIGN KEY (result_id)
            REFERENCES dbo.optimization_results (id)
);

CREATE INDEX ix_optimization_result_metrics_result_id
    ON dbo.optimization_result_metrics (result_id);
