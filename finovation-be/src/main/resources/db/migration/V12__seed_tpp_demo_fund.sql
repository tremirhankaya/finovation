DECLARE @demo_owner_id BIGINT = (
    SELECT TOP (1) id
    FROM dbo.users
    WHERE username = N'superadmin'
      AND status = 'ACTIVE'
      AND is_deleted = 0
    ORDER BY id
);

IF @demo_owner_id IS NOT NULL
BEGIN
    INSERT INTO dbo.fund_drafts
        (public_id, name, fund_type, currency_code, initial_portfolio_size,
         management_approach, liquidity_target_pct, status, created_by_user_id,
         created_at, updated_at)
    VALUES
        ('55555555-5555-4555-8555-555555555555', N'Finovation Likit Karma Fonu',
         'EQUITY_INTENSIVE', 'TRY', 100000000.00, 'BALANCED', 10, 'COMPLETED',
         @demo_owner_id, '2026-01-22T09:00:00', '2026-01-22T09:00:00');
END;
GO

INSERT INTO dbo.fund_portfolios
    (public_id, fund_draft_id, model_run_id, portfolio_type, proposal_rank,
     is_selected, label, created_at, updated_at)
SELECT '66666666-6666-4666-8666-666666666666', draft.id, NULL, 'WORKING', NULL,
       1, N'Likit karma seçili portföyü', draft.created_at, draft.updated_at
FROM dbo.fund_drafts draft
WHERE draft.public_id = '55555555-5555-4555-8555-555555555555';

INSERT INTO dbo.fund_positions (fund_portfolio_id, asset_id, weight)
SELECT portfolio.id, asset.id, allocation.weight
FROM (VALUES
    (N'ASELS.E', CAST(30.0 AS DECIMAL(9, 6))),
    (N'TUPRS.E', CAST(20.0 AS DECIMAL(9, 6))),
    (N'THYAO.E', CAST(20.0 AS DECIMAL(9, 6))),
    (N'GARAN.E', CAST(20.0 AS DECIMAL(9, 6))),
    (N'TPP1G', CAST(10.0 AS DECIMAL(9, 6)))
) allocation(asset_code, weight)
JOIN dbo.assets asset
    ON asset.asset_code = allocation.asset_code
JOIN dbo.fund_drafts draft
    ON draft.public_id = '55555555-5555-4555-8555-555555555555'
JOIN dbo.fund_portfolios portfolio
    ON portfolio.fund_draft_id = draft.id
   AND portfolio.is_selected = 1;
