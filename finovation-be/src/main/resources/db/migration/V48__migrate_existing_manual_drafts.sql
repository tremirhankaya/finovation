ALTER TABLE fund_drafts DROP CONSTRAINT ck_fund_drafts_management_approach;

ALTER TABLE fund_drafts ADD CONSTRAINT ck_fund_drafts_management_approach 
CHECK (management_approach IN ('ATTACK', 'BALANCED', 'PROTECTIVE', 'CUSTOM'));

UPDATE fund_drafts SET management_approach = 'CUSTOM' WHERE design_mode = 'MANUAL';
