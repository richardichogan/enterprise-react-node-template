#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Initial setup script for new project from template
.DESCRIPTION
    Prompts for placeholder values, replaces them across all .tmpl files,
    renames files, creates .env files, and optionally runs npm install.
#>

Write-Host "🚀 Project Setup Wizard" -ForegroundColor Cyan
Write-Host "=====================`n" -ForegroundColor Cyan

# Prompt for values
Write-Host "Enter your project details:" -ForegroundColor Yellow
$appName = Read-Host "App name (e.g., my-awesome-app)"
$org = Read-Host "GitHub org/username (e.g., mycompany)"
$frontendPort = Read-Host "Frontend port (default: 3000)" 
$apiPort = Read-Host "API port (default: 3001)"
$variant = Read-Host "Project variant (frontend-only / api-only / full-stack)" 

if ([string]::IsNullOrWhiteSpace($frontendPort)) { $frontendPort = "3000" }
if ([string]::IsNullOrWhiteSpace($apiPort)) { $apiPort = "3001" }
if ([string]::IsNullOrWhiteSpace($variant)) { $variant = "full-stack" }

Write-Host "`n📝 Configuration:" -ForegroundColor Green
Write-Host "  App Name: $appName"
Write-Host "  Org: $org"
Write-Host "  Frontend Port: $frontendPort"
Write-Host "  API Port: $apiPort"
Write-Host "  Variant: $variant"

$confirm = Read-Host "`nProceed? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Setup cancelled." -ForegroundColor Red
    exit 1
}

# Define replacements
$replacements = @{
    '<APP_NAME>' = $appName
    '<ORG>' = $org
    '<FRONTEND_PORT:3000>' = $frontendPort
    '<FRONTEND_PORT>' = $frontendPort
    '<API_PORT:3001>' = $apiPort
    '<API_PORT>' = $apiPort
}

Write-Host "`n🔄 Replacing placeholders..." -ForegroundColor Cyan

# Find all .tmpl files
$tmplFiles = Get-ChildItem -Path . -Recurse -Filter "*.tmpl" -File

foreach ($file in $tmplFiles) {
    Write-Host "  Processing: $($file.FullName)" -ForegroundColor Gray
    
    $content = Get-Content $file.FullName -Raw
    
    # Replace all placeholders
    foreach ($key in $replacements.Keys) {
        $content = $content -replace [regex]::Escape($key), $replacements[$key]
    }
    
    # Write to new file without .tmpl extension
    $newPath = $file.FullName -replace '\.tmpl$', ''
    Set-Content -Path $newPath -Value $content -NoNewline
    
    # Remove .tmpl file
    Remove-Item $file.FullName
    
    Write-Host "    ✓ Created: $newPath" -ForegroundColor Green
}

# Handle variant-specific setup
Write-Host "`n🎯 Configuring for $variant variant..." -ForegroundColor Cyan

if ($variant -eq "frontend-only") {
    Write-Host "  Removing server folder..." -ForegroundColor Gray
    if (Test-Path "server") { Remove-Item -Recurse -Force "server" }
    
    Write-Host "  Removing API workflow..." -ForegroundColor Gray
    if (Test-Path ".github/workflows/webapp-deploy.yml") { 
        Remove-Item ".github/workflows/webapp-deploy.yml" 
    }
}
elseif ($variant -eq "api-only") {
    Write-Host "  Removing frontend folder..." -ForegroundColor Gray
    if (Test-Path "frontend") { Remove-Item -Recurse -Force "frontend" }
    
    Write-Host "  Removing SWA workflow..." -ForegroundColor Gray
    if (Test-Path ".github/workflows/swa-deploy.yml") { 
        Remove-Item ".github/workflows/swa-deploy.yml" 
    }
}
elseif ($variant -eq "full-stack") {
    Write-Host "  Enabling Vite dev proxy..." -ForegroundColor Gray
    $viteConfig = "frontend/vite.config.ts"
    if (Test-Path $viteConfig) {
        $content = Get-Content $viteConfig -Raw
        $content = $content -replace '// proxy:', 'proxy:'
        $content = $content -replace '// }', '}'
        $content = $content -replace "//   '/api'", "  '/api'"
        Set-Content -Path $viteConfig -Value $content -NoNewline
        Write-Host "    ✓ Dev proxy enabled" -ForegroundColor Green
    }
}

# Create .env files from examples
Write-Host "`n📄 Creating .env files..." -ForegroundColor Cyan

if ((Test-Path "frontend/.env.example") -and ($variant -ne "api-only")) {
    Copy-Item "frontend/.env.example" "frontend/.env"
    Write-Host "  ✓ Created frontend/.env" -ForegroundColor Green
}

if ((Test-Path "server/.env.example") -and ($variant -ne "frontend-only")) {
    Copy-Item "server/.env.example" "server/.env"
    
    # Set PORT in server .env
    $serverEnv = Get-Content "server/.env" -Raw
    $serverEnv = $serverEnv -replace 'PORT=.*', "PORT=$apiPort"
    $serverEnv = $serverEnv -replace 'CORS_ORIGINS=.*', "CORS_ORIGINS=http://localhost:$frontendPort"
    Set-Content -Path "server/.env" -Value $serverEnv -NoNewline
    
    Write-Host "  ✓ Created server/.env (PORT=$apiPort)" -ForegroundColor Green
}

# Optional: Install dependencies
Write-Host "`n📦 Install dependencies now? (y/n)" -ForegroundColor Yellow
$installDeps = Read-Host

if ($installDeps -eq 'y') {
    if ((Test-Path "frontend") -and ($variant -ne "api-only")) {
        Write-Host "`n  Installing frontend dependencies..." -ForegroundColor Cyan
        Push-Location "frontend"
        npm install
        Pop-Location
    }
    
    if ((Test-Path "server") -and ($variant -ne "frontend-only")) {
        Write-Host "`n  Installing API dependencies..." -ForegroundColor Cyan
        Push-Location "server"
        npm install
        Pop-Location
    }
}

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Review and customize docs/ folder"
Write-Host "  2. Update .env files with your specific values"
Write-Host "  3. Start development:"

if ($variant -eq "frontend-only") {
    Write-Host "     cd frontend && npm run dev"
}
elseif ($variant -eq "api-only") {
    Write-Host "     cd server && npm run dev"
}
else {
    Write-Host "     .\scripts\server-manager.ps1 start"
}

Write-Host "`n  4. (Optional) Configure Azure secrets in GitHub for deployment"
Write-Host "`nHappy coding! 🎉`n" -ForegroundColor Cyan
