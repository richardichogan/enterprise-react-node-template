# Pre-Flight Checklist

**Purpose**: Ensure project is in a known good state before starting development work.

**Last Updated**: December 10, 2025

---

## For Developers (Manual Checklist)

### Before Starting Any Coding Session

Run the automated verification script first:
```powershell
.\scripts\verify-state.ps1
```

If all checks pass (✅), you're ready to code. If issues found, work through them below.

---

### Manual Verification Steps

#### 1. Session Context
- [ ] Read latest session notes in `docs/sessions/`
- [ ] Check for TODOs from previous session
- [ ] Review any "DO NOT" items from last session
- [ ] Check if there's an active feature branch

#### 2. Git Status
```powershell
git status
git log --oneline -5
```
- [ ] Working tree clean OR you know what's uncommitted
- [ ] On correct branch (main or feature branch)
- [ ] No unexpected changes

#### 3. Environment Configuration
```powershell
# Check which env files exist
Test-Path .env
Test-Path .env.local
```
- [ ] `.env` file exists with working values
- [ ] `.env.local` either doesn't exist OR matches `.env` for critical values
- [ ] If `.env.local` exists, you know why (documented in session notes)

#### 4. Server Status
```powershell
.\scripts\server-manager.ps1 status
```
- [ ] Backend running on port 3001 (or ready to start)
- [ ] Frontend running on port 3000 (or ready to start)
- [ ] No stray node processes from previous sessions

#### 5. Dependencies
```powershell
# Check if node_modules are fresh
(Get-Item node_modules).LastWriteTime
(Get-Item server/node_modules).LastWriteTime
```
- [ ] `node_modules` exists and recent (relative to package.json changes)
- [ ] `server/node_modules` exists and recent
- [ ] No pending `npm install` needed

#### 6. Build Status (Optional)
```powershell
# Check if production build exists
Test-Path dist
```
- [ ] `dist/` exists if recently built
- [ ] Build is fresh if deploying soon

---

## For GitHub Copilot (Automated Checklist)

### At Start of EVERY Session

Before responding to any user request, mentally check:

1. **Read Session Notes**
   - Path: `docs/sessions/SESSION-NOTES-<latest-date>.md`
   - Look for: TODOs, known issues, "DO NOT" items, environment state

2. **Check Environment State**
   - Does `.env.local` exist?
   - If yes, was it documented in session notes with reason?
   - Does it have Azure OpenAI config? (if yes, must match `.env`)

3. **Understand Current Work**
   - What was last worked on?
   - Any partial implementations?
   - Any known broken features?

4. **Review Active Decisions**
   - Check `docs/architecture/DECISIONS.md` for recent changes
   - Any new patterns to follow?
   - Any "gotchas" to avoid?

### Before Making Changes

1. **Read Action Approval Matrix**
   - Path: `docs/ACTION-APPROVAL-MATRIX.md`
   - Check if action needs permission (🛑 or ⚠️)

2. **Understand Scope**
   - Will change affect working code? → Ask first
   - Will change affect environment? → Ask first
   - Is this what user actually requested? → If unsure, clarify

3. **Check for Side Effects**
   - Will this require server restart? → DON'T DO IT, inform user
   - Will this affect other components? → Mention it
   - Will this change API contracts? → Ask first

### After Making Changes

1. **Update Session Notes**
   - Document what was changed and why
   - Add any new TODOs
   - Note any decisions made
   - Update environment state if changed

2. **Verify No Breakage**
   - Did the change compile? (check for TypeScript errors)
   - Are there obvious runtime issues?
   - Should user manually test something specific?

---

## Common Scenarios

### Scenario 1: Starting Fresh Monday Morning
```powershell
# 1. Run verification
.\scripts\verify-state.ps1

# 2. Read weekend summary
Get-Content docs/sessions/SESSION-NOTES-2025-*-*.md | Select-Object -Last 50

# 3. Start servers if needed
.\scripts\server-manager.ps1 start

# 4. Open browser to http://localhost:3000
```

### Scenario 2: After Pulling from Git
```powershell
# 1. Check what changed
git log --oneline -10
git diff origin/main -- package.json .env

# 2. Install dependencies if package.json changed
npm install
cd server && npm install && cd ..

# 3. Restart servers to pick up new dependencies
.\scripts\server-manager.ps1 restart

# 4. Run verification
.\scripts\verify-state.ps1
```

### Scenario 3: Authentication Stopped Working
```powershell
# 1. Check environment config
Get-Content .env | Select-String -Pattern "AZURE"
if (Test-Path .env.local) {
    Get-Content .env.local | Select-String -Pattern "AZURE"
}

# 2. Delete .env.local if it exists (likely culprit)
Remove-Item .env.local -ErrorAction SilentlyContinue

# 3. Clear browser cache and localStorage
# (Manual: Open DevTools → Application → Clear storage)

# 4. Restart servers
.\scripts\server-manager.ps1 restart
```

### Scenario 4: AI Features Stopped Working
```powershell
# 1. Check OpenAI config
Get-Content .env | Select-String -Pattern "OPENAI"
if (Test-Path .env.local) {
    Write-Host "`n.env.local OpenAI config:"
    Get-Content .env.local | Select-String -Pattern "OPENAI"
}

# 2. If .env.local has different OpenAI values, fix it:
# Option A: Delete .env.local
Remove-Item .env.local

# Option B: Update .env.local to match .env
# (Copy VITE_AZURE_OPENAI_* lines from .env to .env.local)

# 3. Refresh browser (no server restart needed - nodemon handles it)
```

---

## State Verification Frequency

### Every Time
- ✅ At start of development session
- ✅ After pulling from git
- ✅ When something unexpectedly stops working
- ✅ Before deploying to production

### Occasionally
- ⚠️ After major refactoring
- ⚠️ When switching branches
- ⚠️ After installing new dependencies

### Not Needed
- ❌ Between small code changes (trust hot reload)
- ❌ After reading files or searching code
- ❌ During normal development flow

---

## Troubleshooting

### "verify-state.ps1 won't run"
```powershell
# Enable script execution (one-time)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Then run
.\scripts\verify-state.ps1
```

### "Verification script shows issues I don't understand"
1. Copy the output
2. Ask Copilot: "What do these verification issues mean?" (paste output)
3. Copilot will explain and suggest fixes

### "Everything is green but app still broken"
1. Check browser console for errors
2. Check network tab for failed API calls
3. Check session notes for recent known issues
4. Ask Copilot to investigate: "App not working despite clean verification"

---

## Integration with Workflow

### Morning Routine
```powershell
# 1. Verify state
.\scripts\verify-state.ps1

# 2. If warnings/errors, fix them
# 3. Start servers if needed
.\scripts\server-manager.ps1 start

# 4. Open app in browser
# 5. Start coding
```

### End of Day Routine
```powershell
# 1. Commit work
git add .
git commit -m "Descriptive message"

# 2. Update session notes
# - Document what was done
# - Add TODOs for next session
# - Note any issues or decisions

# 3. Optionally stop servers (or leave running overnight)
.\scripts\server-manager.ps1 stop
```

---

## For GitHub Copilot: Session Start Protocol

When user starts a new conversation:

1. **Silently check** (don't announce):
   - Read latest session notes
   - Note if `.env.local` exists
   - Check for active TODOs

2. **Greet user with context**:
   ```
   "Welcome back! I've reviewed session notes from [date]. 
   [Summary of pending work or issues].
   What would you like to work on?"
   ```

3. **If issues detected**:
   ```
   "Before we start, I noticed [issue]. 
   Should we address this first or proceed with something else?"
   ```

4. **If all clean**:
   ```
   "System looks good. Ready to continue with [pending work] 
   or start something new?"
   ```

---

**Bottom Line**: Verify state at session start. Fix issues before coding. Update session notes after work.
