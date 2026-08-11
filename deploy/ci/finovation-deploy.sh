#!/usr/bin/env bash

set -Eeuo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Usage: finovation-deploy <40-character-release-sha>" >&2
    exit 2
fi

release_sha=$1
app_dir=/opt/finovation
env_file="$app_dir/.env.production"
state_dir=/var/lib/finovation-deploy
archive="$state_dir/incoming/$release_sha.tar.gz"
release_root="$app_dir/releases"
release_dir="$release_root/$release_sha"
staging_dir="$release_root/.$release_sha.tmp"
current_link="$app_dir/current"
lock_file="$state_dir/deploy.lock"
previous_release=
switched=0

compose() {
    local compose_dir=$1
    shift
    DEPLOY_VERSION="$release_sha" docker compose \
        --env-file "$env_file" \
        -f "$compose_dir/compose.production.yaml" \
        "$@"
}

restore_previous_release() {
    local exit_code=$?
    trap - ERR

    echo "Deployment $release_sha failed." >&2
    if [[ $switched -eq 1 && -n "$previous_release" && -d "$previous_release" ]]; then
        echo "Restoring $(basename "$previous_release")." >&2
        local previous_version
        if [[ "$previous_release" == "$app_dir" ]]; then
            rm -f "$current_link"
            previous_version=latest
        else
            ln -sfn "$previous_release" "$current_link.rollback"
            mv -Tf "$current_link.rollback" "$current_link"
            previous_version=$(basename "$previous_release")
        fi
        DEPLOY_VERSION="$previous_version" docker compose \
            --env-file "$env_file" \
            -f "$previous_release/compose.production.yaml" \
            up -d --remove-orphans || true
    fi

    exit "$exit_code"
}

install -d -m 700 "$state_dir/incoming"

exec 9>"$lock_file"
if ! flock -n 9; then
    echo "Another production deployment is already running." >&2
    exit 3
fi

[[ -f "$env_file" ]] || {
    echo "Missing $env_file" >&2
    exit 4
}
[[ -f "$archive" ]] || {
    echo "Missing uploaded archive for $release_sha" >&2
    exit 4
}

install -d -m 755 "$release_root"

if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
    echo "Archive contains an unsafe path." >&2
    exit 4
fi

rm -rf "$staging_dir"
mkdir -p "$staging_dir"
tar -xzf "$archive" -C "$staging_dir"

[[ -f "$staging_dir/compose.production.yaml" ]] || {
    echo "Release does not contain compose.production.yaml" >&2
    exit 4
}

compose "$staging_dir" config --quiet
compose "$staging_dir" build --pull

rm -rf "$release_dir"
mv "$staging_dir" "$release_dir"

if [[ -L "$current_link" ]]; then
    previous_release=$(readlink -f "$current_link")
else
    previous_release=$app_dir
fi

trap restore_previous_release ERR
ln -sfn "$release_dir" "$current_link.next"
mv -Tf "$current_link.next" "$current_link"
switched=1

compose "$current_link" up -d --remove-orphans

healthy=0
for _ in $(seq 1 48); do
    frontend_health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' finovation-frontend 2>/dev/null || true)
    fund_engine_health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' finovation-fund-engine 2>/dev/null || true)
    sqlserver_health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' finovation-sqlserver 2>/dev/null || true)
    redis_health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' finovation-redis 2>/dev/null || true)
    backend_state=$(docker inspect --format '{{.State.Status}}' finovation-backend 2>/dev/null || true)
    caddy_state=$(docker inspect --format '{{.State.Status}}' finovation-caddy 2>/dev/null || true)

    if [[ "$frontend_health" == healthy \
        && "$fund_engine_health" == healthy \
        && "$sqlserver_health" == healthy \
        && "$redis_health" == healthy \
        && "$backend_state" == running \
        && "$caddy_state" == running ]]; then
        api_status=$(curl -sS -o /dev/null -w '%{http_code}' \
            --connect-timeout 5 --max-time 15 \
            https://finovation.com.tr/api/v1/auth/me || true)
        if [[ "$api_status" == 200 || "$api_status" == 401 || "$api_status" == 403 ]]; then
            healthy=1
            break
        fi
    fi

    sleep 5
done

if [[ $healthy -ne 1 ]]; then
    compose "$current_link" ps -a >&2 || true
    echo "Production health check timed out." >&2
    false
fi

trap - ERR
rm -f "$archive"
printf '%s %s\n' "$(date --iso-8601=seconds)" "$release_sha" >> "$state_dir/deployments.log"
echo "Finovation release $release_sha is healthy."
