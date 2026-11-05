$ErrorActionPreference = "Stop"

docker compose --file (Join-Path $PSScriptRoot "..\compose.yaml") up --build --detach
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
Write-Output "Project Management MVP is starting at http://localhost:8000"
