# Extract mock event data from Elite Dangerous logs
# This script reads all journal logs and extracts representative samples of each event type

param(
    [string]$LogDir = "C:\Users\Adam\Saved Games\Frontier Developments\Elite Dangerous",
    [string]$OutputDir = "e:\icarus\resources\mock-game-data\events",
    [int]$SamplesPerEvent = 5
)

Write-Host "Extracting mock events from: $LogDir" -ForegroundColor Cyan
Write-Host "Output directory: $OutputDir" -ForegroundColor Cyan
Write-Host "Samples per event: $SamplesPerEvent" -ForegroundColor Cyan
Write-Host ""

# Ensure output directory exists
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Host "Created output directory: $OutputDir" -ForegroundColor Green
}

# Read all journal logs
$logFiles = Get-ChildItem "$LogDir\Journal.*.log"
Write-Host "Found $($logFiles.Count) journal log files" -ForegroundColor Yellow

# Extract events organized by type
$events = @{}
$totalLines = 0

foreach ($logFile in $logFiles) {
    Write-Host "Processing: $($logFile.Name)..." -ForegroundColor Gray
    
    $lines = Get-Content $logFile.FullName
    $totalLines += $lines.Count
    
    foreach ($line in $lines) {
        try {
            $json = $line | ConvertFrom-Json
            
            if ($json.event) {
                $eventType = $json.event
                
                # Initialize array for this event type if needed
                if (-not $events.ContainsKey($eventType)) {
                    $events[$eventType] = @()
                }
                
                # Add sample if we haven't reached the limit
                if ($events[$eventType].Count -lt $SamplesPerEvent) {
                    $events[$eventType] += $json
                }
            }
        } catch {
            # Skip malformed lines
        }
    }
}

Write-Host ""
Write-Host "Processed $totalLines log entries" -ForegroundColor Yellow
Write-Host "Found $($events.Keys.Count) unique event types" -ForegroundColor Yellow
Write-Host ""

# Write each event type to its own file
$eventTypes = $events.Keys | Sort-Object
foreach ($eventType in $eventTypes) {
    $samples = $events[$eventType]
    $filename = "$eventType.json"
    $filepath = Join-Path $OutputDir $filename
    
    # Create a structured output with metadata
    $output = @{
        eventType = $eventType
        description = "Mock data extracted from real Elite Dangerous journal logs"
        sampleCount = $samples.Count
        extractedAt = (Get-Date).ToString("o")
        samples = $samples
    }
    
    # Write as formatted JSON
    $output | ConvertTo-Json -Depth 100 | Set-Content $filepath -Encoding UTF8
    
    Write-Host "  [OK] $filename ($($samples.Count) samples)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Extraction complete! Files written to: $OutputDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  Event types: $($events.Keys.Count)" -ForegroundColor White
Write-Host "  Total samples: $(($events.Values | Measure-Object -Property Count -Sum).Sum)" -ForegroundColor White
Write-Host "  Files created: $($eventTypes.Count)" -ForegroundColor White
