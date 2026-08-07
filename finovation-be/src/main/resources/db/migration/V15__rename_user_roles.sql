ALTER TABLE dbo.users DROP CONSTRAINT ck_users_role_company;
ALTER TABLE dbo.users DROP CONSTRAINT ck_users_role;

UPDATE dbo.users
SET role = CASE role
               WHEN 'SUPER_ADMIN' THEN 'ADMIN'
               WHEN 'ADMIN' THEN 'COMPANY_MANAGER'
               ELSE role
    END;

ALTER TABLE dbo.users
    ADD CONSTRAINT ck_users_role
        CHECK (role IN ('ADMIN', 'COMPANY_MANAGER', 'USER'));

ALTER TABLE dbo.users
    ADD CONSTRAINT ck_users_role_company
        CHECK (
            (role = 'ADMIN' AND company_id IS NULL)
                OR
            (role IN ('COMPANY_MANAGER', 'USER') AND company_id IS NOT NULL)
            );
