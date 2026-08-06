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
        ('11111111-1111-4111-8111-111111111111', N'Finovation Atlas Fonu',
         'EQUITY_INTENSIVE', 'TRY', 100000000.00, 'BALANCED', 5, 'COMPLETED',
         @demo_owner_id, '2025-08-05T09:00:00', '2025-08-05T09:00:00'),
        ('22222222-2222-4222-8222-222222222222', N'Finovation Nova Fonu',
         'EQUITY_INTENSIVE', 'TRY', 50000000.00, 'BALANCED', 5, 'COMPLETED',
         @demo_owner_id, '2026-08-04T09:00:00', '2026-08-04T09:00:00');
END;
GO

INSERT INTO dbo.fund_portfolios
    (public_id, fund_draft_id, model_run_id, portfolio_type, proposal_rank,
     is_selected, label, created_at, updated_at)
SELECT seed.public_id, draft.id, NULL, 'WORKING', NULL, 1, seed.label,
       draft.created_at, draft.updated_at
FROM (VALUES
    (CAST('11111111-1111-4111-8111-111111111111' AS UNIQUEIDENTIFIER),
     CAST('33333333-3333-4333-8333-333333333333' AS UNIQUEIDENTIFIER),
     N'Atlas seçili portföyü'),
    (CAST('22222222-2222-4222-8222-222222222222' AS UNIQUEIDENTIFIER),
     CAST('44444444-4444-4444-8444-444444444444' AS UNIQUEIDENTIFIER),
     N'Nova seçili portföyü')
) seed(fund_public_id, public_id, label)
JOIN dbo.fund_drafts draft
    ON draft.public_id = seed.fund_public_id;

INSERT INTO dbo.fund_positions (fund_portfolio_id, asset_id, weight)
SELECT portfolio.id, asset.id, allocation.weight
FROM (VALUES
    (CAST('11111111-1111-4111-8111-111111111111' AS UNIQUEIDENTIFIER), N'THYAO.E', CAST(18.0 AS DECIMAL(9, 6))),
    (CAST('11111111-1111-4111-8111-111111111111' AS UNIQUEIDENTIFIER), N'ASELS.E', CAST(17.0 AS DECIMAL(9, 6))),
    (CAST('11111111-1111-4111-8111-111111111111' AS UNIQUEIDENTIFIER), N'GARAN.E', CAST(15.0 AS DECIMAL(9, 6))),
    (CAST('11111111-1111-4111-8111-111111111111' AS UNIQUEIDENTIFIER), N'TUPRS.E', CAST(15.0 AS DECIMAL(9, 6))),
    (CAST('11111111-1111-4111-8111-111111111111' AS UNIQUEIDENTIFIER), N'BIMAS.E', CAST(12.0 AS DECIMAL(9, 6))),
    (CAST('11111111-1111-4111-8111-111111111111' AS UNIQUEIDENTIFIER), N'FROTO.E', CAST(10.0 AS DECIMAL(9, 6))),
    (CAST('11111111-1111-4111-8111-111111111111' AS UNIQUEIDENTIFIER), N'TCELL.E', CAST(8.0 AS DECIMAL(9, 6))),
    (CAST('11111111-1111-4111-8111-111111111111' AS UNIQUEIDENTIFIER), N'SISE.E', CAST(5.0 AS DECIMAL(9, 6))),
    (CAST('22222222-2222-4222-8222-222222222222' AS UNIQUEIDENTIFIER), N'AKBNK.E', CAST(20.0 AS DECIMAL(9, 6))),
    (CAST('22222222-2222-4222-8222-222222222222' AS UNIQUEIDENTIFIER), N'KCHOL.E', CAST(18.0 AS DECIMAL(9, 6))),
    (CAST('22222222-2222-4222-8222-222222222222' AS UNIQUEIDENTIFIER), N'EREGL.E', CAST(17.0 AS DECIMAL(9, 6))),
    (CAST('22222222-2222-4222-8222-222222222222' AS UNIQUEIDENTIFIER), N'SASA.E', CAST(15.0 AS DECIMAL(9, 6))),
    (CAST('22222222-2222-4222-8222-222222222222' AS UNIQUEIDENTIFIER), N'PGSUS.E', CAST(12.0 AS DECIMAL(9, 6))),
    (CAST('22222222-2222-4222-8222-222222222222' AS UNIQUEIDENTIFIER), N'MGROS.E', CAST(10.0 AS DECIMAL(9, 6))),
    (CAST('22222222-2222-4222-8222-222222222222' AS UNIQUEIDENTIFIER), N'ENKAI.E', CAST(8.0 AS DECIMAL(9, 6)))
) allocation(fund_public_id, asset_code, weight)
JOIN dbo.fund_drafts draft
    ON draft.public_id = allocation.fund_public_id
JOIN dbo.fund_portfolios portfolio
    ON portfolio.fund_draft_id = draft.id
   AND portfolio.is_selected = 1
JOIN dbo.assets asset
    ON asset.asset_code = allocation.asset_code;
