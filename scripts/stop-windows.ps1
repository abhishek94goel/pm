$ErrorActionPreference = "Stop"

docker compose --file (Join-Path $PSScriptRoot "..\compose.yaml") down
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
