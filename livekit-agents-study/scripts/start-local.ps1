[CmdletBinding()]
param(
    [int]$AppPort = 17828,
    [switch]$NoAgent,
    [switch]$VoiceAgent,
    [switch]$MiniMaxAgent,
    [ValidateRange(1, 4)][int]$MiniMaxWorkers = 2
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $projectRoot ".runtime"
$stateDir = Join-Path $projectRoot ".local-state"
$livekitExe = Join-Path $runtimeDir "livekit-server.exe"
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"
$envFile = Join-Path $projectRoot ".env.local"
$stateFile = Join-Path $stateDir "processes.json"
$stopRequestFile = Join-Path $stateDir "stop.request"
$miniMaxReadyFiles = @()
$appUrl = "http://127.0.0.1:$AppPort"
$livekitHttpUrl = "http://127.0.0.1:7880"

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

if (($NoAgent -and $VoiceAgent) -or ($NoAgent -and $MiniMaxAgent) -or ($VoiceAgent -and $MiniMaxAgent)) {
    throw "-NoAgent、-VoiceAgent 与 -MiniMaxAgent 只能选择一个。"
}

$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
    $projectHash = ([BitConverter]::ToString($sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectRoot)))).Replace("-", "").Substring(0, 16)
} finally {
    $sha256.Dispose()
}
$supervisorMutex = New-Object System.Threading.Mutex($false, "Local\LiveKitAgentsStudy_$projectHash")
$ownsMutex = $false
try {
    $ownsMutex = $supervisorMutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] {
    $ownsMutex = $true
}
if (-not $ownsMutex) {
    $supervisorMutex.Dispose()
    throw "本地栈已经有一个启动窗口在管理。请直接访问 $appUrl，或先运行 .\stop-local.cmd。"
}

if (-not (Test-Path -LiteralPath $livekitExe)) {
    throw "缺少 LiveKit Server。请先运行 .\install-local.cmd"
}
if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw "缺少 Python 虚拟环境。请先运行 .\install-local.cmd"
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules\livekit-client"))) {
    throw "缺少 LiveKit 浏览器客户端。请先运行 .\install-local.cmd"
}

if ($VoiceAgent -or $MiniMaxAgent) {
    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "缺少 .env.local。请从 .env.local.example 创建，并填写相应的模型 API Key。"
    }
    foreach ($line in Get-Content -Encoding UTF8 -LiteralPath $envFile) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $parts = $trimmed.Split("=", 2)
        if ($parts.Count -eq 2) {
            [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
        }
    }
}
if ($VoiceAgent) {
    if (-not $env:OPENAI_API_KEY -or $env:OPENAI_API_KEY -eq "replace-with-your-own-key") {
        throw "OPENAI_API_KEY 尚未配置。请编辑 .env.local 后重试。"
    }
}
if ($MiniMaxAgent) {
    $keyMissing = -not $env:MINIMAX_API_KEY -or $env:MINIMAX_API_KEY -eq "replace-with-your-token-plan-key"
    $sharedConfigPath = Join-Path $projectRoot "..\agentscope-study\config.local.json"
    if ($keyMissing -and (Test-Path -LiteralPath $sharedConfigPath)) {
        try {
            $sharedConfig = Get-Content -Encoding UTF8 -Raw -LiteralPath $sharedConfigPath | ConvertFrom-Json
        } catch {
            throw "发现 AgentScope 本地配置，但无法读取：$sharedConfigPath"
        }
        $sharedKey = [string]$sharedConfig.api_key
        if ($sharedConfig.provider -eq "minimax" -and $sharedKey -and $sharedKey -notmatch "replace|example|your-key") {
            $env:MINIMAX_API_KEY = $sharedKey
            if ([string]$sharedConfig.model) {
                $env:MINIMAX_LLM_MODEL = [string]$sharedConfig.model
            }
            if (([string]$sharedConfig.base_url) -match "/anthropic/?$") {
                $env:MINIMAX_LLM_BASE_URL = ([string]$sharedConfig.base_url).TrimEnd("/")
            }
            Write-Host "已复用 AgentScope 的本地 MiniMax 配置（密钥不会复制或输出）。" -ForegroundColor Cyan
        }
    }
    if (-not $env:MINIMAX_API_KEY -or $env:MINIMAX_API_KEY -eq "replace-with-your-token-plan-key") {
        throw "MINIMAX_API_KEY 尚未配置。请在 Token Plan 页面获取 Key，编辑 .env.local 后重试。"
    }

    $xiaomiAsrKeyConfigured = $env:MIMO_API_KEY -and $env:MIMO_API_KEY -ne "replace-with-your-xiaomi-mimo-key"
    $xiaomiTokenPlanNeedsBaseUrl = $xiaomiAsrKeyConfigured -and $env:MIMO_API_KEY.StartsWith("tp-") -and -not $env:MIMO_ASR_BASE_URL
    $xiaomiAsrEnabled = $xiaomiAsrKeyConfigured -and -not $xiaomiTokenPlanNeedsBaseUrl
    if (-not $xiaomiAsrEnabled) {
        Remove-Item Env:MIMO_API_KEY -ErrorAction SilentlyContinue
        if ($xiaomiTokenPlanNeedsBaseUrl) {
            Write-Host "检测到小米 tp- Token Plan Key，但缺少套餐专属 MIMO_ASR_BASE_URL；暂时保留文字输入。" -ForegroundColor Yellow
        } else {
            Write-Host "未配置小米 MIMO_API_KEY：保留文字输入；配置后会自动启用麦克风识别。" -ForegroundColor Yellow
        }
    }
}

function Test-HttpReady {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 1
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Start-LocalProcess {
    param(
        [string]$FilePath,
        [string]$Arguments
    )
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = $Arguments
    $startInfo.WorkingDirectory = $projectRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    return [System.Diagnostics.Process]::Start($startInfo)
}

function New-TrackedProcessEntry {
    param(
        [string]$Name,
        [System.Diagnostics.Process]$Process
    )
    $Process.Refresh()
    return [ordered]@{
        name = $Name
        pid = $Process.Id
        process_name = $Process.ProcessName
        executable_path = [IO.Path]::GetFullPath($Process.StartInfo.FileName)
        start_time_utc = $Process.StartTime.ToUniversalTime().ToString("o")
    }
}

function Test-TrackedProcess {
    param($Entry)
    if (-not $Entry.process_name -or -not $Entry.executable_path -or -not $Entry.start_time_utc) { return $false }
    $process = Get-Process -Id $Entry.pid -ErrorAction SilentlyContinue
    if (-not $process -or $process.ProcessName -ne $Entry.process_name) { return $false }
    try {
        if ([IO.Path]::GetFullPath($process.Path) -ne [IO.Path]::GetFullPath([string]$Entry.executable_path)) { return $false }
        $expectedStart = [DateTimeOffset]::Parse([string]$Entry.start_time_utc).UtcDateTime
        $actualStart = $process.StartTime.ToUniversalTime()
        return [Math]::Abs(($actualStart - $expectedStart).TotalSeconds) -le 1
    } catch {
        return $false
    }
}

function Wait-HttpReady {
    param([string]$Url, [int]$Attempts = 30)
    for ($attempt = 0; $attempt -lt $Attempts; $attempt++) {
        if (Test-Path -LiteralPath $stopRequestFile) { return $false }
        if (Test-HttpReady -Url $Url) { return $true }
        Start-Sleep -Milliseconds 300
    }
    return $false
}

if (Test-Path -LiteralPath $stateFile) {
    try {
        $previousState = Get-Content -Encoding UTF8 -Raw -LiteralPath $stateFile | ConvertFrom-Json
        $activeEntries = @($previousState.processes | Where-Object { Test-TrackedProcess -Entry $_ })
    } catch {
        $activeEntries = @()
    }
    if ($activeEntries.Count -gt 0) {
        throw "本地栈已经由 start-local.cmd 管理并正在运行。请直接访问 $appUrl，或先运行 .\stop-local.cmd。"
    }
    Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
}

if ((Test-HttpReady -Url $livekitHttpUrl) -or (Test-HttpReady -Url "$appUrl/api/status")) {
    throw "检测到未由当前启动记录管理的 LiveKit 或网页服务。为避免重复进程，请先停止占用 7880/$AppPort 端口的旧服务。"
}
Remove-Item -LiteralPath $stopRequestFile -Force -ErrorAction SilentlyContinue
Get-ChildItem -LiteralPath $stateDir -Filter "minimax-agent*.ready.json" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
$agentMode = $(if ($MiniMaxAgent -and $xiaomiAsrEnabled) { "minimax-voice" } elseif ($MiniMaxAgent) { "minimax-text-voice" } elseif ($VoiceAgent) { "openai-realtime" } elseif ($NoAgent) { "none" } else { "local-text" })
$maxConcurrentJobs = 0
if ($MiniMaxAgent) {
    if (-not $env:AGENT_MAX_CONCURRENT_JOBS) {
        $env:AGENT_MAX_CONCURRENT_JOBS = "2"
    }
    if (-not $env:AGENT_FAILURE_LAB_ENABLED) {
        $env:AGENT_FAILURE_LAB_ENABLED = "true"
    }
    $parsedMaxConcurrentJobs = 0
    if (-not [int]::TryParse($env:AGENT_MAX_CONCURRENT_JOBS, [ref]$parsedMaxConcurrentJobs) -or $parsedMaxConcurrentJobs -lt 1 -or $parsedMaxConcurrentJobs -gt 8) {
        throw "AGENT_MAX_CONCURRENT_JOBS 必须是 1–8 的整数。"
    }
    $maxConcurrentJobs = $parsedMaxConcurrentJobs
    $workerStatusUrls = @()
    for ($workerIndex = 1; $workerIndex -le $MiniMaxWorkers; $workerIndex++) {
        $workerPort = 8080 + $workerIndex
        $workerStatusUrls += "http://127.0.0.1:$workerPort/worker"
        $miniMaxReadyFiles += Join-Path $stateDir "minimax-agent.worker-$workerIndex.ready.json"
    }
    $env:AGENT_WORKER_STATUS_URLS = $workerStatusUrls -join ","
    $env:AGENT_WORKER_READY_PATHS = $miniMaxReadyFiles -join ","
}
$dispatchAgentName = $(if ($MiniMaxAgent) { "livekit-research-minimax" } else { "" })
if ($dispatchAgentName) {
    $env:LIVEKIT_AGENT_NAME = $dispatchAgentName
} else {
    Remove-Item Env:LIVEKIT_AGENT_NAME -ErrorAction SilentlyContinue
}

$ownedProcesses = @()
$resilientProcessIds = @()
$reportedExitedPids = @{}
$supervisorProcess = Get-Process -Id $PID
$state = [ordered]@{
    session_id = [Guid]::NewGuid().ToString("n")
    supervisor = [ordered]@{
        pid = $PID
        process_name = $supervisorProcess.ProcessName
        executable_path = $supervisorProcess.Path
        start_time_utc = $supervisorProcess.StartTime.ToUniversalTime().ToString("o")
    }
    app_url = $appUrl
    livekit_url = "ws://127.0.0.1:7880"
    agent_mode = $agentMode
    dispatch_agent_name = $dispatchAgentName
    max_concurrent_jobs = $maxConcurrentJobs
    worker_replicas = $(if ($MiniMaxAgent) { $MiniMaxWorkers } else { 0 })
    started_at = (Get-Date).ToString("o")
    processes = @()
}

function Save-State {
    $state | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath $stateFile
}

try {
    Write-Host "[1/3] 启动 LiveKit Server 1.13.5..." -ForegroundColor Cyan
    $livekitProcess = Start-LocalProcess -FilePath $livekitExe -Arguments "--dev --bind 127.0.0.1"
    $ownedProcesses += $livekitProcess
    $state.processes += New-TrackedProcessEntry -Name "livekit" -Process $livekitProcess
    Save-State

    if (-not (Wait-HttpReady -Url $livekitHttpUrl)) {
        throw "LiveKit Server 未能在 127.0.0.1:7880 就绪"
    }

    Write-Host "[2/3] 启动本地令牌与网页服务..." -ForegroundColor Cyan
    $appArguments = "src\local_demo_server.py --host 127.0.0.1 --port $AppPort --livekit-url ws://127.0.0.1:7880 --agent-mode $agentMode"
    if ($dispatchAgentName) {
        $appArguments += " --agent-name $dispatchAgentName"
    }
    $appProcess = Start-LocalProcess -FilePath $pythonExe -Arguments $appArguments
    $ownedProcesses += $appProcess
    $state.processes += New-TrackedProcessEntry -Name "web" -Process $appProcess
    Save-State

    # The status endpoint probes every configured Worker. Those Workers start
    # in the next step, so use the static page as the web-process readiness
    # signal and reserve /api/status for runtime observability.
    if (-not (Wait-HttpReady -Url "$appUrl/")) {
        throw "本地网页服务未能在 $appUrl 就绪"
    }

    if ($MiniMaxAgent) {
        $miniMaxDescription = $(if ($xiaomiAsrEnabled) { "小米 MiMo ASR + MiniMax M3 + Speech 2.8" } else { "MiniMax M3 + Speech 2.8（文字输入）" })
        Write-Host "[3/3] 启动 $MiniMaxWorkers 个同名 $miniMaxDescription Agent Worker..." -ForegroundColor Cyan
        $agentArguments = "src\minimax_agent.py start --log-level info"
        $agentProcesses = @()
        for ($workerIndex = 1; $workerIndex -le $MiniMaxWorkers; $workerIndex++) {
            $env:AGENT_INSTANCE_ID = "worker-$workerIndex"
            $env:AGENT_HTTP_PORT = [string](8080 + $workerIndex)
            $env:AGENT_READY_PATH = $miniMaxReadyFiles[$workerIndex - 1]
            $workerProcess = Start-LocalProcess -FilePath $pythonExe -Arguments $agentArguments
            $agentProcesses += $workerProcess
            $ownedProcesses += $workerProcess
            $resilientProcessIds += $workerProcess.Id
            $state.processes += New-TrackedProcessEntry -Name "minimax-agent-$workerIndex" -Process $workerProcess
        }
        Save-State
    } elseif ($VoiceAgent) {
        Write-Host "[3/3] 启动 OpenAI Realtime 语音 Agent..." -ForegroundColor Cyan
        $agentArguments = "src\voice_agent_template.py start --log-level info"
        $agentProcess = Start-LocalProcess -FilePath $pythonExe -Arguments $agentArguments
        $ownedProcesses += $agentProcess
        $state.processes += New-TrackedProcessEntry -Name "voice-agent" -Process $agentProcess
        Save-State
    } elseif (-not $NoAgent) {
        Write-Host "[3/3] 启动无云 Key 的文字 Agent..." -ForegroundColor Cyan
        $env:LIVEKIT_URL = "ws://127.0.0.1:7880"
        $env:LIVEKIT_API_KEY = "devkey"
        $env:LIVEKIT_API_SECRET = "secret"
        $agentArguments = "src\local_text_agent.py start --log-level info"
        $agentProcess = Start-LocalProcess -FilePath $pythonExe -Arguments $agentArguments
        $ownedProcesses += $agentProcess
        $state.processes += New-TrackedProcessEntry -Name "text-agent" -Process $agentProcess
        Save-State
    } else {
        Write-Host "[3/3] 已跳过 Agent。" -ForegroundColor Yellow
    }

    if ($MiniMaxAgent) {
        $workerRegistered = $false
        for ($attempt = 0; $attempt -lt 120; $attempt++) {
            foreach ($workerProcess in $agentProcesses) {
                $workerProcess.Refresh()
                if ($workerProcess.HasExited) {
                    throw "Agent Worker PID $($workerProcess.Id) 启动后立即退出，退出码 $($workerProcess.ExitCode)"
                }
            }
            $registeredCount = 0
            foreach ($readyFile in $miniMaxReadyFiles) {
                if (-not (Test-Path -LiteralPath $readyFile)) { continue }
                try {
                    $readyState = Get-Content -Encoding UTF8 -Raw -LiteralPath $readyFile | ConvertFrom-Json
                    if ($readyState.worker_id -and $readyState.mode -eq $agentMode) {
                        $registeredCount += 1
                    }
                } catch {
                    # The Agent writes atomically, but retry a partial/locked read.
                }
            }
            if ($registeredCount -eq $MiniMaxWorkers) {
                $workerRegistered = $true
                break
            }
            Start-Sleep -Milliseconds 250
        }
        if (-not $workerRegistered) {
            throw "$MiniMaxWorkers 个 MiniMax Agent Worker 未能全部在 30 秒内向 LiveKit 注册"
        }
    } elseif (-not $NoAgent) {
        # Give the worker time to register before telling the user to create a
        # room. LiveKit only dispatches an anonymous worker when the room job
        # is created; joining a fraction too early can otherwise miss it.
        Start-Sleep -Milliseconds 1500
        $agentProcess.Refresh()
        if ($agentProcess.HasExited) {
            throw "Agent Worker 启动后立即退出，退出码 $($agentProcess.ExitCode)"
        }
    }

    Save-State
    Write-Host ""
    Write-Host "本地 LiveKit 已就绪：$appUrl" -ForegroundColor Green
    Write-Host "网页会为每次浏览器会话生成唯一房间名。LiveKit：ws://127.0.0.1:7880"
    Write-Host "保持此窗口运行；按 Ctrl+C 停止本次启动的服务。"

    while ($true) {
        if (Test-Path -LiteralPath $stopRequestFile) {
            Write-Host "收到停止请求，正在关闭本次启动的服务..." -ForegroundColor Yellow
            break
        }
        foreach ($process in $ownedProcesses) {
            if ($process.HasExited) {
                if ($resilientProcessIds -contains $process.Id) {
                    if (-not $reportedExitedPids.ContainsKey($process.Id)) {
                        Write-Warning "研究 Worker PID $($process.Id) 已退出，保留其余本地服务与 Worker 继续运行。"
                        $reportedExitedPids[$process.Id] = $true
                    }
                    continue
                }
                throw "后台进程 PID $($process.Id) 已退出，退出码 $($process.ExitCode)"
            }
        }
        Start-Sleep -Seconds 1
    }
} finally {
    for ($index = $ownedProcesses.Count - 1; $index -ge 0; $index--) {
        $process = $ownedProcesses[$index]
        if ($process -and -not $process.HasExited) {
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stopRequestFile -Force -ErrorAction SilentlyContinue
    foreach ($readyFile in $miniMaxReadyFiles) {
        Remove-Item -LiteralPath $readyFile -Force -ErrorAction SilentlyContinue
    }
    if ($ownsMutex) {
        $supervisorMutex.ReleaseMutex()
        $ownsMutex = $false
    }
    $supervisorMutex.Dispose()
    Write-Host "本次启动的本地服务已停止。" -ForegroundColor Yellow
}
