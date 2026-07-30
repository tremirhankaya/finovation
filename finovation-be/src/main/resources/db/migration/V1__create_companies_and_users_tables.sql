CREATE TABLE dbo.companies
(
    id         BIGINT IDENTITY (1,1) NOT NULL,
    name       NVARCHAR(150) NOT NULL,
    status     VARCHAR(20) NOT NULL,
    created_at DATETIME2(6) NOT NULL
        CONSTRAINT df_companies_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(6) NOT NULL
        CONSTRAINT df_companies_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_companies PRIMARY KEY (id),
    CONSTRAINT uk_companies_name UNIQUE (name),
    CONSTRAINT ck_companies_status
        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE dbo.users
(
    id                       BIGINT IDENTITY (1,1) NOT NULL,
    company_id               BIGINT NULL,
    username                 NVARCHAR(100) NOT NULL,
    first_name               NVARCHAR(100) NOT NULL,
    last_name                NVARCHAR(100) NOT NULL,
    email                    NVARCHAR(254) NOT NULL,
    password                 VARCHAR(100) NOT NULL,
    role                     VARCHAR(20) NOT NULL,
    status                   VARCHAR(20) NOT NULL,
    password_change_required BIT NOT NULL
        CONSTRAINT df_users_password_change_required DEFAULT 1,
    created_at               DATETIME2(6) NOT NULL
        CONSTRAINT df_users_created_at DEFAULT SYSUTCDATETIME(),
    updated_at               DATETIME2(6) NOT NULL
        CONSTRAINT df_users_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uk_users_username UNIQUE (username),
    CONSTRAINT uk_users_email UNIQUE (email),

    CONSTRAINT fk_users_company
        FOREIGN KEY (company_id)
            REFERENCES dbo.companies (id),

    CONSTRAINT ck_users_role
        CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'USER')),

    CONSTRAINT ck_users_status
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED')),

    CONSTRAINT ck_users_role_company
        CHECK (
            (role = 'SUPER_ADMIN' AND company_id IS NULL)
                OR
            (role IN ('ADMIN', 'USER') AND company_id IS NOT NULL)
            )
);

CREATE INDEX ix_users_company_id
    ON dbo.users (company_id);