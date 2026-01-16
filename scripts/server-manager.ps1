Param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('status','start','stop','restart','logs')]
    [string]$Action
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = (Resolve-Path (Join-Path $ScriptDir '..')).Path
$FrontendDir = Join-Path $RepoRoot 'frontend'
$ApiDir      = Join-Path $RepoRoot 'server'

$FrontendPort = 3000
$ApiPort      = 3001

function Get-PortProcess {
    param(
        [int]$Port
    )
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
        if ($conn) {
            return Get-Process -Id $conn.OwningProcess -ErrorAction Stop
        }
    } catch {
        return $null
    }
    return $null
}

function Show-Status {
    $frontProc = Get-PortProcess -Port $FrontendPort
    $apiProc   = Get-PortProcess -Port $ApiPort

    if ($frontProc) {
        Write-Host "Frontend ($FrontendPort): RUNNING pid $($frontProc.Id) [$($frontProc.ProcessName)]"
    } else {
        Write-Host "Frontend ($FrontendPort): stopped"
    }

    if ($apiProc) {
        Write-Host "API      ($ApiPort): RUNNING pid $($apiProc.Id) [$($apiProc.ProcessName)]"
    } else {
        Write-Host "API      ($ApiPort): stopped"
    }
}

function Start-Services {
    # Close any orphaned PowerShell windows running npm before starting
    Write-Host "Cleaning up old PowerShell windows..."
    Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { 
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        $cmdLine -match "npm run dev"
    } | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Host "Starting frontend (port $FrontendPort) in new terminal..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$FrontendDir`"; npm run dev"

    Write-Host "Starting API (port $ApiPort) in new terminal..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$ApiDir`"; npm run dev"
}

function Stop-Services {
    $frontProc = Get-PortProcess -Port $FrontendPort
    if ($frontProc) {
        Write-Host "Stopping frontend pid $($frontProc.Id)..."
        Stop-Process -Id $frontProc.Id -Force
    } else {
        Write-Host "Frontend not running on port $FrontendPort"
    }

    $apiProc = Get-PortProcess -Port $ApiPort
    if ($apiProc) {
        Write-Host "Stopping API pid $($apiProc.Id)..."
        Stop-Process -Id $apiProc.Id -Force
    } else {
        Write-Host "API not running on port $ApiPort"
    }
    
    # Close any PowerShell windows that were running the servers
    Start-Sleep -Milliseconds 500
    Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { 
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        $cmdLine -match "npm run dev"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Show-Logs {
    Write-Host "Logs are shown in the terminals started for frontend and API."
}

switch ($Action) {
    'status'  { Show-Status }
    'start'   { Start-Services }
    'stop'    { Stop-Services }
    'restart' { Stop-Services; Start-Services }
    'logs'    { Show-Logs }
}
