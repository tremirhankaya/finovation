-- V34__seed_diplomatic_statement_market_shock_scenario_and_shocks.sql
-- Seeds the 2023 diplomatic statement market shock scenario and 59 asset shocks.

SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM dbo.stress_scenarios WHERE code = 'S01_ISRAIL_HAMAS_REMARKS_2023')
BEGIN
    UPDATE dbo.stress_scenarios
    SET
        name = N'Diplomatik Açıklama Sonrası Piyasa Şoku 24.10–25.10.2023',
        description = N'24 Ekim 2023 kapanışından 25 Ekim 2023 kapanışına tarihsel piyasa yolu; Cumhurbaşkanı Erdoğan''ın İsrail-Hamas savaşı hakkındaki açıklamalarını izleyen akut satış dalgası ve devre kesici etkisi.',
        horizon_days = 1,
        display_order = 5,
        is_active = 1,
        updated_at = SYSUTCDATETIME()
    WHERE code = 'S01_ISRAIL_HAMAS_REMARKS_2023';
END
ELSE
BEGIN
    INSERT INTO dbo.stress_scenarios (
        code, name, description, horizon_days, display_order, is_active
    )
    VALUES (
        'S01_ISRAIL_HAMAS_REMARKS_2023',
        N'Diplomatik Açıklama Sonrası Piyasa Şoku 24.10–25.10.2023',
        N'24 Ekim 2023 kapanışından 25 Ekim 2023 kapanışına tarihsel piyasa yolu; Cumhurbaşkanı Erdoğan''ın İsrail-Hamas savaşı hakkındaki açıklamalarını izleyen akut satış dalgası ve devre kesici etkisi.',
        1,
        5,
        1
    );
END;

DECLARE @Shocks TABLE (
    scenario_code VARCHAR(50) NOT NULL,
    asset_code NVARCHAR(50) NOT NULL,
    impact DECIMAL(20, 12) NOT NULL,
    PRIMARY KEY (scenario_code, asset_code)
);

INSERT INTO @Shocks (scenario_code, asset_code, impact)
VALUES
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'AEFES.E', CAST('-0.031064327100' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'AKBNK.E', CAST('-0.065067962300' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'AKSA.E', CAST('-0.053774324300' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'AKSEN.E', CAST('-0.084391991400' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'ALARK.E', CAST('-0.097666339000' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'ALBRK.E', CAST('-0.085252037600' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'ASELS.E', CAST('-0.054839983100' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'AYGAZ.E', CAST('-0.075747701900' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'BIMAS.E', CAST('-0.060033164600' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'BRISA.E', CAST('-0.082905080100' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'BRSAN.E', CAST('-0.065242555000' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'CCOLA.E', CAST('-0.022844356400' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'CIMSA.E', CAST('-0.069645295300' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'CLEBI.E', CAST('-0.027479986700' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'DEVA.E', CAST('-0.077778545500' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'DOAS.E', CAST('-0.063319396900' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'DOHOL.E', CAST('-0.081881986000' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'ECILC.E', CAST('-0.073475784800' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'EGEEN.E', CAST('-0.072497147400' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'EKGYO.E', CAST('-0.086065860500' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'ENKAI.E', CAST('-0.081028730500' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'EREGL.E', CAST('-0.088516559100' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'FENER.E', CAST('-0.036408393000' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'FROTO.E', CAST('-0.026825826500' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'GARAN.E', CAST('-0.084507779600' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'GSRAY.E', CAST('-0.068843448700' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'GUBRF.E', CAST('-0.081483486700' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'HALKB.E', CAST('-0.085851648400' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'ISCTR.E', CAST('-0.079163141400' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'ISGYO.E', CAST('-0.091452991500' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'KARSN.E', CAST('-0.090995260700' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'KCHOL.E', CAST('-0.055248585600' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'KORDS.E', CAST('-0.083467094700' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'KRDMD.E', CAST('-0.085331519000' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'MGROS.E', CAST('-0.064359228500' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'NETAS.E', CAST('-0.094931617100' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'ODAS.E', CAST('-0.059382422800' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'OTKAR.E', CAST('-0.073387811600' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'PETKM.E', CAST('-0.099622285200' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'PGSUS.E', CAST('-0.067540108100' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'SAHOL.E', CAST('-0.062276403100' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'SASA.E', CAST('-0.096211153700' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'SISE.E', CAST('-0.065616364900' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'TATGD.E', CAST('-0.100003221800' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'TAVHL.E', CAST('-0.097020626400' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'TCELL.E', CAST('-0.046607916300' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'THYAO.E', CAST('-0.068807061600' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'TKFEN.E', CAST('-0.080687830800' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'TOASO.E', CAST('-0.071509609900' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'TSKB.E', CAST('-0.091906721300' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'TTKOM.E', CAST('-0.071428571400' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'TTRAK.E', CAST('-0.066362820100' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'TUPRS.E', CAST('-0.062042840900' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'ULKER.E', CAST('-0.099580888000' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'VAKBN.E', CAST('-0.070520231200' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'VESTL.E', CAST('-0.087295401400' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'YKBNK.E', CAST('-0.058229753100' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'ZOREN.E', CAST('-0.097682119200' AS DECIMAL(20, 12))),
    ('S01_ISRAIL_HAMAS_REMARKS_2023', N'TPP1G', CAST('0.000867397300' AS DECIMAL(20, 12)));

IF (SELECT COUNT(*) FROM @Shocks WHERE scenario_code = 'S01_ISRAIL_HAMAS_REMARKS_2023') <> 59
BEGIN
    THROW 50041, 'Expected exactly 59 shocks for S01_ISRAIL_HAMAS_REMARKS_2023.', 1;
END;

IF EXISTS (
    SELECT 1
    FROM @Shocks s
    LEFT JOIN dbo.assets a ON a.asset_code = s.asset_code
    WHERE a.id IS NULL
)
BEGIN
    THROW 50042, 'Stress shock dataset contains an asset that does not exist in dbo.assets.', 1;
END;

IF EXISTS (
    SELECT 1
    FROM @Shocks s
    LEFT JOIN dbo.stress_scenarios ss ON ss.code = s.scenario_code
    WHERE ss.id IS NULL
)
BEGIN
    THROW 50043, 'Stress shock dataset contains an unknown scenario code.', 1;
END;

UPDATE target
SET
    target.impact = source.impact,
    target.updated_at = SYSUTCDATETIME()
FROM dbo.stress_scenario_asset_shocks target
JOIN dbo.stress_scenarios scenario ON scenario.id = target.scenario_id
JOIN dbo.assets asset ON asset.id = target.asset_id
JOIN @Shocks source
    ON source.scenario_code = scenario.code
   AND source.asset_code = asset.asset_code;

INSERT INTO dbo.stress_scenario_asset_shocks (scenario_id, asset_id, impact)
SELECT scenario.id, asset.id, source.impact
FROM @Shocks source
JOIN dbo.stress_scenarios scenario ON scenario.code = source.scenario_code
JOIN dbo.assets asset ON asset.asset_code = source.asset_code
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.stress_scenario_asset_shocks existing
    WHERE existing.scenario_id = scenario.id
      AND existing.asset_id = asset.id
);

IF (
    SELECT COUNT(*)
    FROM dbo.stress_scenario_asset_shocks shock
    JOIN dbo.stress_scenarios scenario ON scenario.id = shock.scenario_id
    WHERE scenario.code = 'S01_ISRAIL_HAMAS_REMARKS_2023'
) <> 59
BEGIN
    THROW 50044, 'Persisted shock coverage is not 59/59 for S01_ISRAIL_HAMAS_REMARKS_2023.', 1;
END;

SET NOCOUNT OFF;
