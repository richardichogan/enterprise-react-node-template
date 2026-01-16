# Pre-Commit Test Script
# Runs before committing changes to briefing deck generation
# Usage: .\scripts\test-before-commit.ps1

Write-Host "`n🧪 PRE-COMMIT TEST SUITE" -ForegroundColor Cyan
Write-Host "========================`n" -ForegroundColor Cyan

# Track overall status
$allPassed = $true

# ============================================================================
# STEP 1: Backend Syntax Check
# ============================================================================
Write-Host "📝 [1/5] Backend Syntax Check..." -ForegroundColor Yellow

$syntaxFiles = @(
    "server\index.js",
    "server\services\briefingDeckService.js",
    "server\services\icaService.js"
)

foreach ($file in $syntaxFiles) {
    Write-Host "   Checking $file..."
    node --check $file
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Syntax error in $file" -ForegroundColor Red
        $allPassed = $false
    }
}

if ($allPassed) {
    Write-Host "   ✅ All syntax checks passed`n" -ForegroundColor Green
}

# ============================================================================
# STEP 2: Backend Unit Tests
# ============================================================================
Write-Host "🔬 [2/5] Backend Unit Tests..." -ForegroundColor Yellow

if (Test-Path "server\test-multipass-simple.js") {
    Set-Location server
    node test-multipass-simple.js
    Set-Location ..
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Backend unit tests failed" -ForegroundColor Red
        $allPassed = $false
    } else {
        Write-Host "   ✅ Backend unit tests passed`n" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠️  No unit test file found (server\test-multipass-simple.js)" -ForegroundColor Yellow
}

# ============================================================================
# STEP 3: Server Restart
# ============================================================================
Write-Host "🔄 [3/5] Restarting Servers..." -ForegroundColor Yellow

.\scripts\server-manager.ps1 restart

if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Failed to restart servers" -ForegroundColor Red
    $allPassed = $false
    exit 1
}

Write-Host "   ✅ Servers restarted`n" -ForegroundColor Green

# Wait for servers to start
Write-Host "   Waiting 3 seconds for servers to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# ============================================================================
# STEP 4: Server Health Check
# ============================================================================
Write-Host "🏥 [4/5] Server Health Check..." -ForegroundColor Yellow

$frontendOk = $false
$apiOk = $false

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Frontend responding (port 3000)" -ForegroundColor Green
        $frontendOk = $true
    }
} catch {
    Write-Host "   ❌ Frontend not responding (port 3000)" -ForegroundColor Red
    $allPassed = $false
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ API responding (port 3001)" -ForegroundColor Green
        $apiOk = $true
    }
} catch {
    # Try root endpoint if /health doesn't exist
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001" -Method GET -TimeoutSec 5 -UseBasicParsing
        Write-Host "   ✅ API responding (port 3001)" -ForegroundColor Green
        $apiOk = $true
    } catch {
        Write-Host "   ❌ API not responding (port 3001)" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

# ============================================================================
# STEP 5: Manual UI Verification
# ============================================================================
Write-Host "👁️  [5/5] MANUAL UI VERIFICATION REQUIRED" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Complete the E2E test checklist:" -ForegroundColor Cyan
Write-Host "   📄 docs\testing\E2E-TEST-CHECKLIST.md`n" -ForegroundColor White

Write-Host "Key verification steps:" -ForegroundColor Yellow
Write-Host "   1. Open: http://localhost:3000" -ForegroundColor White
Write-Host "   2. Go to Briefing Deck Generator tab" -ForegroundColor White
Write-Host "   3. Select test documents" -ForegroundColor White
Write-Host "   4. Click 'Generate Briefing Deck'" -ForegroundColor White
Write-Host "   5. Verify ALL slide fields display" -ForegroundColor White
Write-Host "   6. SPOT-CHECK: No hallucinated compliance flags" -ForegroundColor Red
Write-Host "   7. SPOT-CHECK: Slide titles match briefing pack" -ForegroundColor Red
Write-Host "   8. SPOT-CHECK: Structure matches source docs" -ForegroundColor Red
Write-Host ""

# Open browser automatically
Write-Host "Opening browser..." -ForegroundColor Gray
Start-Process "http://localhost:3000"

Write-Host ""
$continue = Read-Host "Press 'y' when E2E checklist is complete, or 'n' to fail test (y/n)"

if ($continue -ne 'y') {
    Write-Host "`n❌ Manual verification failed or incomplete" -ForegroundColor Red
    $allPassed = $false
}

# ============================================================================
# FINAL RESULTS
# ============================================================================
Write-Host "`n" 
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "                            TEST RESULTS" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan

if ($allPassed) {
    Write-Host "`n✅ ALL TESTS PASSED - Safe to commit`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ TESTS FAILED - DO NOT COMMIT`n" -ForegroundColor Red
    Write-Host "Fix issues and re-run tests before committing." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
