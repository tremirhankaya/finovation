ALTER TABLE dbo.model_runs
    ADD rules_fingerprint NVARCHAR(200) NULL;

CREATE INDEX ix_model_runs_draft_status
    ON dbo.model_runs (fund_draft_id, status);

ALTER TABLE dbo.fund_positions
    ADD ai_note NVARCHAR(200) NULL;
