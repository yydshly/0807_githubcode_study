[CmdletBinding()]
param([string]$Room = "local-demo")

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $projectRoot ".env.local"
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "缺少 .env.local。请复制 .env.local.example，并填写你自己的 OPENAI_API_KEY。"
}

foreach ($line in Get-Content -Encoding UTF8 -LiteralPath $envFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $parts = $trimmed.Split("=", 2)
    if ($parts.Count -eq 2) {
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

if (-not $env:OPENAI_API_KEY -or $env:OPENAI_API_KEY -eq "replace-with-your-own-key") {
    throw "OPENAI_API_KEY 尚未配置。"
}

Push-Location $projectRoot
try {
    & $pythonExe src\voice_agent_template.py connect --room $Room --participant-identity voice-agent --log-level info
} finally {
    Pop-Location
}
