$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$upstreamDir = Join-Path $projectRoot "upstream"
$upstreamPackageDir = Join-Path $upstreamDir "livekit-agents"
$upstreamUrl = "https://github.com/livekit/agents.git"
$pinnedUpstreamCommit = "2f218b6fb9c9a65c8b8499c103aa1262cff73158"
$runtimeDir = Join-Path $projectRoot ".runtime"
$archivePath = Join-Path $runtimeDir "livekit_1.13.5_windows_amd64.zip"
$serverExe = Join-Path $runtimeDir "livekit-server.exe"
$expectedHash = "3ec7eaa76ef64063bf21f78364733703e0969612cb92ffd60661ed45fa4a8906"
$downloadUrl = "https://github.com/livekit/livekit/releases/download/v1.13.5/livekit_1.13.5_windows_amd64.zip"

$commandChecks = @(
    [PSCustomObject]@{ Name = "git"; Help = "请安装 Git for Windows，并把 git 加入 PATH" },
    [PSCustomObject]@{ Name = "python"; Help = "请安装 Python，并把 python 加入 PATH" },
    [PSCustomObject]@{ Name = "uv"; Help = "请安装 uv，并把 uv 加入 PATH" },
    [PSCustomObject]@{ Name = "npm.cmd"; Help = "请安装 Node.js（包含 npm），并把 npm 加入 PATH" }
)
$missingCommands = @()
foreach ($commandCheck in $commandChecks) {
    if (-not (Get-Command -Name $commandCheck.Name -ErrorAction SilentlyContinue)) {
        $missingCommands += "$($commandCheck.Name)：$($commandCheck.Help)"
    }
}
if ($missingCommands.Count -gt 0) {
    throw ("安装前置检查失败，缺少必需命令：`r`n- " + ($missingCommands -join "`r`n- "))
}

if (-not (Test-Path -LiteralPath $upstreamPackageDir -PathType Container)) {
    if (Test-Path -LiteralPath $upstreamDir) {
        if (-not (Test-Path -LiteralPath $upstreamDir -PathType Container)) {
            throw "无法获取 LiveKit Agents：$upstreamDir 已存在，但它不是目录。为避免覆盖数据，安装已停止。"
        }

        $upstreamContents = @(Get-ChildItem -LiteralPath $upstreamDir -Force)
        if ($upstreamContents.Count -gt 0) {
            throw "无法获取 LiveKit Agents：$upstreamPackageDir 不存在，但 $upstreamDir 不是空目录。为避免覆盖现有文件，安装已停止；请先人工检查该目录。"
        }
    }

    Write-Host "获取固定版本的 LiveKit Agents..." -ForegroundColor Cyan
    & git clone $upstreamUrl $upstreamDir
    if ($LASTEXITCODE -ne 0) {
        throw "从 $upstreamUrl 获取 LiveKit Agents 失败（git clone 退出码：$LASTEXITCODE）。"
    }

    $upstreamSafePath = $upstreamDir.Replace("\", "/")
    & git -c "safe.directory=$upstreamSafePath" -C $upstreamDir checkout --detach $pinnedUpstreamCommit
    if ($LASTEXITCODE -ne 0) {
        throw "无法将新获取的 LiveKit Agents 切换到固定提交 $pinnedUpstreamCommit（git checkout 退出码：$LASTEXITCODE）。"
    }
}

$upstreamSafePath = $upstreamDir.Replace("\", "/")
$headOutput = @(& git -c "safe.directory=$upstreamSafePath" -C $upstreamDir rev-parse HEAD 2>&1)
$headExitCode = $LASTEXITCODE
$currentUpstreamCommit = (($headOutput | Out-String).Trim())
if ($headExitCode -ne 0) {
    throw "无法验证 LiveKit Agents 版本。请确认 $upstreamDir 是有效的 Git 仓库。Git 输出：$currentUpstreamCommit"
}
if (-not [System.StringComparer]::OrdinalIgnoreCase.Equals($currentUpstreamCommit, $pinnedUpstreamCommit)) {
    throw "LiveKit Agents 版本不匹配。当前 HEAD：$currentUpstreamCommit；要求提交：$pinnedUpstreamCommit。为避免覆盖你的本地改动，安装已停止；请人工备份并切换版本后重试。"
}
if (-not (Test-Path -LiteralPath $upstreamPackageDir -PathType Container)) {
    throw "固定提交中未找到 $upstreamPackageDir，安装已停止。"
}
Write-Host "LiveKit Agents 固定提交校验通过：$currentUpstreamCommit" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

if (-not (Test-Path -LiteralPath $archivePath) -or (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant() -ne $expectedHash) {
    Write-Host "下载 LiveKit Server 1.13.5 Windows x64..." -ForegroundColor Cyan
    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $archivePath
}

$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
if ($actualHash -ne $expectedHash) {
    throw "LiveKit Server SHA-256 校验失败"
}
Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeDir -Force
if (-not (Test-Path -LiteralPath $serverExe)) { throw "解压后未找到 livekit-server.exe" }
Write-Host "LiveKit Server 校验通过：$actualHash" -ForegroundColor Green

Push-Location $projectRoot
try {
    if (-not (Test-Path -LiteralPath ".venv\Scripts\python.exe")) {
        python -m venv .venv
    }
    uv pip install --python .venv\Scripts\python.exe -r requirements.txt --cache-dir ..\.uv-cache-livekit
    npm.cmd install --no-audit --no-fund
} finally {
    Pop-Location
}

Write-Host "安装完成。下一步运行 .\start-local.cmd" -ForegroundColor Green
