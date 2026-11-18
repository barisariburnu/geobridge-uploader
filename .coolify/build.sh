#!/bin/sh
set -eu
build_env=${1:-/artifacts/build-time.env}
revision=${SOURCE_COMMIT:-}
# Parse only the native immutable revision. Never execute the environment file.
if [ -z "$revision" ] && [ -r "$build_env" ]; then
    revision=$(sed -n 's/^SOURCE_COMMIT=//p' "$build_env")
    case "$revision" in
        \"*\") revision=${revision#\"}; revision=${revision%\"} ;;
        \'*\') revision=${revision#\'}; revision=${revision%\'} ;;
    esac
fi
if [ -z "$revision" ]; then
    revision=$(git rev-parse --verify HEAD 2>/dev/null) || revision=''
fi
case "$revision" in
    ''|*[!0-9a-f]*) printf '%s\n' source_revision_unavailable >&2; exit 35 ;;
esac
if [ "${#revision}" -ne 40 ]; then
    printf '%s\n' source_revision_unavailable >&2
    exit 35
fi
if [ -r "$build_env" ]; then
    docker compose --project-directory . --env-file "$build_env" -f .coolify/compose.yaml build --build-arg MONITORING_SOURCE_REVISION="$revision"
else
    docker compose --project-directory . -f .coolify/compose.yaml build --build-arg MONITORING_SOURCE_REVISION="$revision"
fi
