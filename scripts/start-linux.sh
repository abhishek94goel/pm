#!/bin/sh
set -eu

project_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
docker compose --file "$project_root/compose.yaml" up --build --detach
printf 'Project Management MVP is starting at http://localhost:8000\n'
