ALTER TABLE dbo.fund_design_profiles
    ADD above_threshold_pct       DECIMAL(9, 4) NULL,
        above_threshold_sum_max   DECIMAL(9, 4) NULL,
        weight_sum_tolerance_pct  DECIMAL(9, 4) NULL;
GO

UPDATE dbo.fund_design_profiles
SET above_threshold_pct = 5.0000,
    above_threshold_sum_max = 40.0000,
    weight_sum_tolerance_pct = 0.0500
WHERE fund_type = 'EQUITY_INTENSIVE';
GO

ALTER TABLE dbo.fund_design_profiles
    ALTER COLUMN above_threshold_pct DECIMAL(9, 4) NOT NULL;
GO

ALTER TABLE dbo.fund_design_profiles
    ALTER COLUMN above_threshold_sum_max DECIMAL(9, 4) NOT NULL;
GO

ALTER TABLE dbo.fund_design_profiles
    ALTER COLUMN weight_sum_tolerance_pct DECIMAL(9, 4) NOT NULL;
GO
