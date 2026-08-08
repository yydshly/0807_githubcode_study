$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stateFile = Join-Path $projectRoot ".local-state\processes.json"
$stopRequestFile = Join-Path $projectRoot ".local-state\stop.request"

if (-not (Test-Path -LiteralPath $stateFile)) {
    Write-Host "没有找到由 start-local.cmd 记录的运行进程。"
    exit 0
}

$state = Get-Content -Encoding UTF8 -Raw -LiteralPath $stateFile | ConvertFrom-Json

function Test-TrackedProcess {
    param($Entry, [System.Diagnostics.Process]$Process)
    if (-not $Entry.process_name -or -not $Entry.executable_path -or -not $Entry.start_time_utc) { return $false }
    if (-not $Process -or $Process.ProcessName -ne $Entry.process_name) { return $false }
    try {
        if ([IO.Path]::GetFullPath($Process.Path) -ne [IO.Path]::GetFullPath([string]$Entry.executable_path)) { return $false }
        $expectedStart = [DateTimeOffset]::Parse([string]$Entry.start_time_utc).UtcDateTime
        $actualStart = $Process.StartTime.ToUniversalTime()
        return [Math]::Abs(($actualStart - $expectedStart).TotalSeconds) -le 1
    } catch {
        return $false
    }
}

$supervisorProcess = $null
if ($state.supervisor -and $state.supervisor.pid) {
    $supervisorProcess = Get-Process -Id $state.supervisor.pid -ErrorAction SilentlyContinue
}
if ($supervisorProcess -and (Test-TrackedProcess -Entry $state.supervisor -Process $supervisorProcess)) {
    Set-Content -LiteralPath $stopRequestFile -Value "stop" -Encoding ASCII
    Write-Host "已向本地栈发送停止请求。"
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        if (-not (Get-Process -Id $state.supervisor.pid -ErrorAction SilentlyContinue)) {
            Write-Host "本地栈已安全停止。"
            exit 0
        }
    }
    Write-Warning "启动窗口未在 10 秒内退出，将只回收身份校验仍匹配的进程。"
}

for ($index = $state.processes.Count - 1; $index -ge 0; $index--) {
    $entry = $state.processes[$index]
    $process = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
    if (Test-TrackedProcess -Entry $entry -Process $process) {
        Stop-Process -Id $entry.pid -Force
        Write-Host "已停止 $($entry.name) (PID $($entry.pid))"
    } elseif ($process) {
        Write-Warning "跳过 PID $($entry.pid)：进程身份或启动时间与记录不一致。"
    }
}
Remove-Item -LiteralPath $stateFile -Force -ErrorAction SilentlyContinue
