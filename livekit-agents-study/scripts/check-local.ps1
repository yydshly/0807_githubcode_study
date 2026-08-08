[CmdletBinding()]
param([int]$AppPort = 17828)

$checks = @(
    [ordered]@{ Name = "LiveKit Server"; Url = "http://127.0.0.1:7880/" },
    [ordered]@{ Name = "Local Token App"; Url = "http://127.0.0.1:$AppPort/api/status" },
    [ordered]@{ Name = "Local Console"; Url = "http://127.0.0.1:$AppPort/" }
)

$failed = 0
foreach ($check in $checks) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $check.Url -TimeoutSec 3
        Write-Host "PASS  $($check.Name)  HTTP $($response.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "FAIL  $($check.Name)  $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

if ($failed -gt 0) { exit 1 }
