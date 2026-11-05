# Script guidance

This directory contains start/stop scripts for macOS and Linux (`.sh`) and Windows (`.ps1`). They use Docker Compose from the repository root.

- On macOS, if Docker Desktop's CLI is not already on `PATH`, the scripts should use its bundled CLI under `/Applications/Docker.app/Contents/Resources/bin`.
- Keep scripts non-interactive and fail when Docker Compose fails.
- Start the app without removing its named data volume.
- Stop the app with `docker compose down`; do not delete persisted user data.
- Keep platform-specific commands and paths within the matching script.