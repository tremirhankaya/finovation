#!/usr/bin/env bash

set -Eeuo pipefail

state_dir=/var/lib/finovation-deploy
incoming_dir="$state_dir/incoming"
original_command=${SSH_ORIGINAL_COMMAND:-}

valid_sha() {
    [[ "$1" =~ ^[0-9a-f]{40}$ ]]
}

install -d -m 700 "$incoming_dir"

case "$original_command" in
    "upload "*)
        release_sha=${original_command#upload }
        if ! valid_sha "$release_sha"; then
            echo "Invalid release identifier." >&2
            exit 2
        fi

        umask 077
        temporary_archive="$incoming_dir/$release_sha.tar.gz.part"
        final_archive="$incoming_dir/$release_sha.tar.gz"
        trap 'rm -f "$temporary_archive"' EXIT
        cat > "$temporary_archive"
        tar -tzf "$temporary_archive" >/dev/null
        mv -f "$temporary_archive" "$final_archive"
        trap - EXIT
        echo "Release $release_sha uploaded."
        ;;
    "deploy "*)
        release_sha=${original_command#deploy }
        if ! valid_sha "$release_sha"; then
            echo "Invalid release identifier." >&2
            exit 2
        fi

        exec /usr/local/sbin/finovation-deploy "$release_sha"
        ;;
    *)
        echo "This key is restricted to Finovation deployments." >&2
        exit 2
        ;;
esac
