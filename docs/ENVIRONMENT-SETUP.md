# Environment Configuration Guide

**Purpose**: Document environment file structure, precedence, and common pitfalls.

**Last Updated**: December 10, 2025

---

## Environment Files Overview

### File Precedence (Highest to Lowest)

1. **`.env.local`** (gitignored, developer-specific overrides)
2. **`.env`** (committed, shared defaults for all developers)
3. **`.env.example`** (template only, has placeholder values)

**Critical Rule**: Vite loads `.env.local` FIRST. If a variable exists there, it overrides `.env`.

---

## File Purposes

### `.env` (Committed to Git)
- **Purpose**: Shared configuration for all developers
- **Contains**: Real working values for development
- **Who edits**: Anyone via git commits
- **Example use**: Default Azure workspace ID, backend URL

### `.env.local` (Gitignored)
- **Purpose**: Developer-specific overrides ONLY
- **Contains**: Only values that differ from `.env` for this developer
- **Who edits**: Individual developer only (not shared)
- **Example use**: Personal Azure subscription for testing

### `.env.example` (Template)
- **Purpose**: Documentation of required variables
- **Contains**: Placeholder values (`your-value-here`)
- **Who edits**: Updated when new variables are added
- **Example use**: New developer sees what to configure

---

## 🚨 CRITICAL RULES

### Rule 1: Never Create `.env.local` from `.env.example`
**Problem**: `.env.example` has placeholders, not real values.

**Correct Process**:
```powershell
# IF you need .env.local for overrides:
Copy-Item .env .env.local
# Then edit .env.local to change ONLY what you need different
```

**Better**: Don't create `.env.local` unless you actually need overrides.

---

### Rule 2: Keep `.env.local` Minimal
**Bad** (unnecessarily duplicates everything):
```env
# .env.local - DON'T DO THIS
VITE_AZURE_CLIENT_ID=2b710e47-9dc8-4be2-b3cf-2ac6fd2b610e
VITE_AZURE_TENANT_ID=ff0c1708-ff8b-425a-9534-071748d38e3a
VITE_AZURE_WORKSPACE_ID=9adb0969-43ef-4f6d-bf94-145f5dce86a1
# ... entire .env copied
```

**Good** (only overrides what's needed):
```env
# .env.local - Only override what's different for you
VITE_AZURE_SUBSCRIPTION_ID=my-personal-subscription-id
```

---

### Rule 3: Verify OpenAI Config Stays in Sync

**Problem**: If `.env.local` exists and has `VITE_AZURE_OPENAI_*` variables, they MUST match `.env`.

**Why**: Azure OpenAI is configured and working. If `.env.local` has different values, it breaks AI features.

**Solution**: If `.env.local` has OpenAI variables, they should match `.env` exactly:
```powershell
# Check if .env.local has OpenAI config
Get-Content .env.local | Select-String -Pattern "OPENAI"

# If found, verify they match .env
Get-Content .env | Select-String -Pattern "OPENAI"
```

---

## Configuration Details

### Required Variables (Must be in `.env`)

#### Azure AD Authentication
```env
VITE_AZURE_CLIENT_ID=<Azure AD app client ID>
VITE_AZURE_TENANT_ID=<Azure AD tenant ID>
VITE_AZURE_REDIRECT_URI=http://localhost:3000
```

#### Azure Monitor / Sentinel
```env
VITE_AZURE_WORKSPACE_ID=<Log Analytics workspace ID>
VITE_AZURE_WORKSPACE_NAME=<Workspace display name>
```

#### Backend Server
```env
VITE_BACKEND_URL=http://localhost:3001
```

---

### Optional Variables

#### Azure OpenAI (AI-Powered Features)
```env
VITE_AZURE_OPENAI_ENDPOINT=https://<resource-name>.openai.azure.com
VITE_AZURE_OPENAI_API_KEY=<your-api-key>
VITE_AZURE_OPENAI_DEPLOYMENT=gpt-4o
VITE_AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

**Status**: Configured and working in this project. DO NOT use placeholder values.

#### Sentinel API (Optional)
```env
VITE_AZURE_SUBSCRIPTION_ID=<subscription-id>
VITE_AZURE_RESOURCE_GROUP=<resource-group-name>
```

#### Application Insights (Optional)
```env
VITE_APPINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
```

---

## Verification Process

### Manual Verification
```powershell
# Check if .env.local exists
Test-Path .env.local

# If yes, compare OpenAI config
Write-Host "`n=== .env ==="
Get-Content .env | Select-String -Pattern "OPENAI"
Write-Host "`n=== .env.local ==="
Get-Content .env.local | Select-String -Pattern "OPENAI"

# They should match exactly (or .env.local shouldn't have them)
```

### Automated Verification
```powershell
# Run state verification script
.\scripts\verify-state.ps1

# Will check:
# - .env.local exists?
# - If yes, does it have OpenAI config?
# - If yes, does it match .env?
```

---

## Common Problems & Solutions

### Problem 1: "Azure OpenAI not configured" (but it is)
**Symptom**: AI features show "Configure Azure OpenAI" message

**Cause**: `.env.local` has placeholder OpenAI values, overriding real values in `.env`

**Solution**:
```powershell
# Option A: Delete .env.local (use .env for everything)
Remove-Item .env.local

# Option B: Update .env.local with real values from .env
# Copy the VITE_AZURE_OPENAI_* lines from .env to .env.local
```

---

### Problem 2: Authentication timeout
**Symptom**: `monitor_window_timeout` error in browser

**Cause**: Missing or incorrect Azure AD configuration

**Solution**:
```powershell
# Verify Azure AD variables exist
Get-Content .env | Select-String -Pattern "VITE_AZURE_CLIENT_ID|VITE_AZURE_TENANT_ID"

# Check Azure AD app registration matches:
# - Client ID matches VITE_AZURE_CLIENT_ID
# - Redirect URI includes http://localhost:3000
```

---

### Problem 3: Backend connection failed
**Symptom**: "Backend API not available" in UI

**Cause**: `VITE_BACKEND_URL` incorrect or backend not running

**Solution**:
```powershell
# Check backend URL
Get-Content .env | Select-String -Pattern "VITE_BACKEND_URL"

# Verify backend is running
.\scripts\server-manager.ps1 status

# Test backend health
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

---

## Development Workflow

### Starting a New Development Session
1. Check if `.env.local` exists: `Test-Path .env.local`
2. If yes, verify it's in sync: `.\scripts\verify-state.ps1`
3. Start servers: `.\scripts\server-manager.ps1 start`
4. Verify environment: Check browser console for any "not configured" warnings

### After Pulling from Git
1. Check if `.env` has new variables: `git diff origin/main -- .env`
2. If yes, update your `.env.local` if you have overrides
3. Restart dev server if environment changed (only if needed)

### Before Committing
1. Never commit `.env.local` (should be in `.gitignore`)
2. If you added new variables, update `.env.example` with placeholders
3. Update this document if new variables need explanation

---

## Emergency Recovery

### "Everything was working, now it's broken"
```powershell
# 1. Delete .env.local (start fresh)
Remove-Item .env.local -ErrorAction SilentlyContinue

# 2. Restart servers
.\scripts\server-manager.ps1 restart

# 3. Clear browser cache and refresh
# 4. Check browser console for errors
```

### "I need to reset environment to known good state"
```powershell
# 1. Delete .env.local
Remove-Item .env.local -ErrorAction SilentlyContinue

# 2. Verify .env is correct
Get-Content .env

# 3. Stop all servers
.\scripts\server-manager.ps1 stop

# 4. Kill any stray node processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# 5. Start fresh
.\scripts\server-manager.ps1 start
```

---

## Best Practices

### ✅ Do This
- Keep `.env.local` minimal (only actual overrides)
- Document why you have `.env.local` if you do
- Delete `.env.local` when you no longer need overrides
- Use `.\scripts\verify-state.ps1` at session start

### ❌ Don't Do This
- Don't create `.env.local` from `.env.example`
- Don't duplicate entire `.env` into `.env.local`
- Don't commit `.env.local` to git
- Don't assume `.env.local` exists for other developers

---

## For GitHub Copilot

When creating or modifying environment files:

1. **ALWAYS ASK FIRST** before creating `.env.local`
2. If user has authentication issue, check `.env` first (don't create `.env.local`)
3. If `.env.local` must be created, copy from `.env`, NOT `.env.example`
4. If modifying `.env.local`, preserve all existing values (especially OpenAI)
5. After any environment changes, remind user to verify (don't auto-restart)

---

**Bottom Line**: `.env` is source of truth. `.env.local` is for exceptions only. When in doubt, delete `.env.local`.
