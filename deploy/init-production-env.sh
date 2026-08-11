#!/usr/bin/env sh

set -eu

env_file="${1:-.env.production}"

if [ -e "$env_file" ]; then
    echo "Refusing to overwrite existing $env_file" >&2
    exit 1
fi

umask 077

mssql_password="Fnv!$(openssl rand -hex 24)"
jwt_secret="$(openssl rand -hex 64)"
password_reset_secret="$(openssl rand -hex 64)"
ai_engine_api_key="$(openssl rand -hex 32)"
grafana_password="Fnv!$(openssl rand -hex 24)"

cat > "$env_file" <<EOF
ACME_EMAIL=replace-with-real-email

MSSQL_PID=Express
MSSQL_SA_PASSWORD=$mssql_password
MSSQL_MEMORY_LIMIT_MB=4096
DB_NAME=finovation

JWT_SECRET=$jwt_secret
PASSWORD_RESET_SECRET=$password_reset_secret
AI_ENGINE_API_KEY=$ai_engine_api_key

INFINA_BASE_URL=replace-with-production-infina-url
INFINA_API_KEY=replace-with-production-infina-api-key

FINANCIAL_TIME_SIMULATION_ENABLED=false
FINANCIAL_TIME_ZONE=Europe/Istanbul
MARKETDATA_SYNC_ENABLED=false
MARKETDATA_BOOTSTRAP_ON_STARTUP=false

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_SMTP_AUTH=true
MAIL_STARTTLS_ENABLED=true
MAIL_FROM=noreply@finovation.com.tr

GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=$grafana_password
EOF

chmod 600 "$env_file"
echo "Created $env_file with generated secrets."
echo "Edit ACME_EMAIL, INFINA_BASE_URL, and INFINA_API_KEY before deployment."
