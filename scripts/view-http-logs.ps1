# View HTTP Request Logs

# This script tails the HTTP request log file in real-time
# Useful for watching requests as they happen

Write-Host "=== ICARUS HTTP Request Logger ===" -ForegroundColor Cyan
Write-Host ""

$logFile = "E:\icarus\http-requests.log"

if (-not (Test-Path $logFile)) {
    Write-Host "Log file not found: $logFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The log file will be created when the service starts." -ForegroundColor Yellow
    Write-Host "Have you started the service yet?" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To start the service:" -ForegroundColor Cyan
    Write-Host "  npm start" -ForegroundColor White
    Write-Host "  or" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Watching log file: $logFile" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop watching" -ForegroundColor Gray
Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""

# Tail the log file (shows last 50 lines, then follows new content)
Get-Content $logFile -Tail 50 -Wait
