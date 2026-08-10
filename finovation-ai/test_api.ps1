$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$uv = Get-Command uv -ErrorAction SilentlyContinue
if ($null -eq $uv) {
    throw "uv was not found."
}

Set-Location -LiteralPath $root
& $uv.Source sync --python 3.11 --locked
if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed."
}
$env:FUND_ML_ROOT = $root
$env:PYTHONPATH = Join-Path $root "src"
& (Join-Path $root ".venv\Scripts\python.exe") -m pytest
exit $LASTEXITCODE
