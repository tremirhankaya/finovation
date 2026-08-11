ALTER TABLE dbo.fund_drafts
    ADD is_deleted  BIT NOT NULL
            CONSTRAINT df_fund_drafts_is_deleted DEFAULT 0,
        design_mode VARCHAR(20) NOT NULL
            CONSTRAINT df_fund_drafts_design_mode DEFAULT 'AI_ASSISTED',
        is_pinned BIT NOT NULL
            CONSTRAINT df_fund_drafts_is_pinned DEFAULT 0,
        deleted_by_user_id BIGINT NULL;
GO

ALTER TABLE dbo.fund_drafts
    ADD CONSTRAINT ck_fund_drafts_design_mode
        CHECK (design_mode IN ('AI_ASSISTED', 'MANUAL'));
GO

CREATE INDEX ix_fund_drafts_is_deleted
    ON dbo.fund_drafts (is_deleted);
GO
