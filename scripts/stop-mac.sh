#!/bin/sh
set -eu

if ! command -v docker >/dev/null 2>&1; then
  docker_bin="/Applications/Docker.app/Contents/Resources/bin"
  if [ -x "$docker_bin/docker" ]; then
    PATH="$docker_bin:$PATH"
    export PATH
  fi
fi

project_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
docker compose --file "$project_root/compose.yaml" down
