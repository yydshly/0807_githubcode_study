[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $projectRoot ".env.local"
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Missing .env.local."
}

foreach ($line in Get-Content -Encoding UTF8 -LiteralPath $envFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $parts = $trimmed.Split("=", 2)
    if ($parts.Count -eq 2) {
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

$miniMaxMissing = -not $env:MINIMAX_API_KEY -or $env:MINIMAX_API_KEY -eq "replace-with-your-token-plan-key"
$sharedConfigPath = Join-Path $projectRoot "..\agentscope-study\config.local.json"
if ($miniMaxMissing -and (Test-Path -LiteralPath $sharedConfigPath)) {
    $sharedConfig = Get-Content -Encoding UTF8 -Raw -LiteralPath $sharedConfigPath | ConvertFrom-Json
    if ($sharedConfig.provider -eq "minimax" -and [string]$sharedConfig.api_key) {
        $env:MINIMAX_API_KEY = [string]$sharedConfig.api_key
    }
}

if (-not $env:MINIMAX_API_KEY -or $env:MINIMAX_API_KEY -eq "replace-with-your-token-plan-key") {
    throw "MINIMAX_API_KEY is not configured; cannot generate the speech fixture."
}
if (-not $env:MIMO_API_KEY -or $env:MIMO_API_KEY -eq "replace-with-your-xiaomi-mimo-key") {
    throw "MIMO_API_KEY is not configured."
}
if ($env:MIMO_API_KEY.StartsWith("tp-") -and -not $env:MIMO_ASR_BASE_URL) {
    throw "A tp- Token Plan key requires MIMO_ASR_BASE_URL from the Xiaomi MiMo Token Plan page."
}

Push-Location $projectRoot
try {
    & $pythonExe src\xiaomi_mimo_asr_smoke.py
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
