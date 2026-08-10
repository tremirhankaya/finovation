$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$uv = Get-Command uv -ErrorAction SilentlyContinue
if ($null -eq $uv) {
    throw "uv was not found. Install uv once, then rerun setup_api.ps1."
}

Set-Location -LiteralPath $root
& $uv.Source sync --python 3.11 --locked --no-dev
if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed."
}

Write-Host "API environment is ready: $root\.venv"
