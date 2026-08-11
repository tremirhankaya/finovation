WITH CTE AS (
    SELECT id, name,
           ROW_NUMBER() OVER(PARTITION BY name ORDER BY id) as rn
    FROM fund_drafts
    WHERE name IS NOT NULL AND is_deleted = 0
)
UPDATE CTE
SET name = name + ' (Kopya ' + CAST(rn AS VARCHAR) + ')'
WHERE rn > 1;

CREATE UNIQUE NONCLUSTERED INDEX uidx_fund_drafts_name 
ON fund_drafts(name) 
WHERE name IS NOT NULL AND is_deleted = 0;
