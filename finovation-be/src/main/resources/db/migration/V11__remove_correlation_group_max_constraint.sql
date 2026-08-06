ALTER TABLE dbo.optimization_request_constraint_targets
    DROP CONSTRAINT ck_optimization_request_constraint_targets_code;

ALTER TABLE dbo.optimization_request_constraint_targets
    ADD CONSTRAINT ck_optimization_request_constraint_targets_code
        CHECK (constraint_code IN (
            'EQUITY_WEIGHT_MIN', 'EQUITY_WEIGHT_MAX', 'TPP_MIN', 'TPP_MAX',
            'SINGLE_STOCK_MIN', 'SINGLE_STOCK_MAX', 'STOCK_COUNT_MIN', 'STOCK_COUNT_MAX',
            'SECTOR_MAX'
        ));

ALTER TABLE dbo.optimization_constraint_checks
    DROP CONSTRAINT ck_optimization_constraint_checks_code;

ALTER TABLE dbo.optimization_constraint_checks
    ADD CONSTRAINT ck_optimization_constraint_checks_code
        CHECK (constraint_code IN (
            'EQUITY_WEIGHT_MIN', 'EQUITY_WEIGHT_MAX', 'TPP_MIN', 'TPP_MAX',
            'SINGLE_STOCK_MIN', 'SINGLE_STOCK_MAX', 'STOCK_COUNT_MIN', 'STOCK_COUNT_MAX',
            'SECTOR_MAX'
        ));
