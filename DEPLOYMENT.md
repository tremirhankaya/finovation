# Finovation production deployment

The production stack runs on a single amd64 Linux host with Docker Compose.
Only Caddy publishes host ports (`80` and `443`). SQL Server, Redis, the Java
API, and the Python engine stay on private Docker networks.

## Prerequisites

- Ubuntu 24.04 amd64
- Docker Engine and the Docker Compose plugin
- DNS `A` records for `finovation.com.tr` and `www.finovation.com.tr` pointing
  to the server
- Inbound TCP ports `22`, `80`, and `443` allowed

## Configure

Market-data synchronization is disabled by default because the Infina endpoint may require private DNS, VPN access, or IP allowlisting. Enable `MARKETDATA_SYNC_ENABLED` and `MARKETDATA_BOOTSTRAP_ON_STARTUP` only after the production server can resolve and reach the configured Infina endpoint.

Copy the example environment file and replace every placeholder:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Generate secrets on the server rather than committing them:

```bash
openssl rand -base64 64
openssl rand -base64 64
openssl rand -hex 32
openssl rand -base64 36
```

Use the generated values for `JWT_SECRET`, `PASSWORD_RESET_SECRET`,
`AI_ENGINE_API_KEY`, and `MSSQL_SA_PASSWORD`, respectively. SQL Server password
policy requires upper/lowercase letters, numbers, and symbols; verify the
generated database password satisfies the policy and add characters if needed.

## Validate and start

```bash
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps
```

Monitoring is optional and remains private. Start it after setting the Grafana
admin password:

```bash
docker compose --profile monitoring --env-file .env.production -f compose.production.yaml up -d
```

Grafana binds only to server loopback. Access it with an SSH tunnel:

```bash
ssh -L 3000:127.0.0.1:3000 root@SERVER_IP
```

Then open `http://127.0.0.1:3000` locally.

## Operations

### Optional private Fortinet VPN

If the Infina endpoint is available only through a Fortinet SSL VPN, install `openfortivpn` and `dnsutils`, then use the root-only templates under `deploy/vpn` together with `deploy/systemd/finovation-vpn.service`. Keep `set-routes` and `set-dns` disabled so the public SSH and HTTPS routes are not replaced. Store the VPN configuration with mode `600` and the route script with mode `700`.

View service status and logs:

```bash
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs --tail=200
```

Update application images after uploading a new source bundle:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

Back up SQL Server to off-server storage on a schedule. Host snapshots are a
second recovery layer, not a replacement for database backups.
