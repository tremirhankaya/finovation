param(
    [string]$HostAddress = "127.0.0.1",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
    & (Join-Path $root "setup_api.ps1")
}
if (-not (Test-Path -LiteralPath $python)) {
    throw "Python environment was not created: $python"
}

Set-Location -LiteralPath $root
& $python (Join-Path $root "run_server.py") --host $HostAddress --port $Port
exit $LASTEXITCODE
