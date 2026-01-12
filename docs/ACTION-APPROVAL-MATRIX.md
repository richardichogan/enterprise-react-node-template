# Action Approval Matrix

**Purpose**: Clear boundaries for GitHub Copilot on when to ask vs. act autonomously.

**Last Updated**: December 10, 2025

---

## 🛑 ALWAYS ASK FIRST (MANDATORY APPROVAL)

### File Operations
- ❌ Delete ANY file (code, config, data, docs)
- ❌ Create new environment files (`.env.*`, `web.config`, etc.)
- ❌ Rename files or move them between directories
- ❌ Modify `.gitignore` or `.git` configuration

### Server & Process Management
- ❌ Restart servers or development processes
- ❌ Kill running processes (node, npm, etc.)
- ❌ Change server ports or networking config
- ❌ Start/stop background services

### Deployment & Production
- ❌ Deploy to Azure (frontend or backend)
- ❌ Push to git remote (`git push`)
- ❌ Create or modify CI/CD workflows
- ❌ Change Azure configuration (App Service, Static Web Apps, etc.)

### Architecture & Breaking Changes
- ❌ Change API endpoints or request/response formats
- ❌ Modify authentication flow (MSAL, token handling)
- ❌ Change data structures used across multiple components
- ❌ Refactor working code patterns (unless explicitly requested)
- ❌ Add new external dependencies (npm packages)

### Database & Data
- ❌ Modify data files (`defender-logs.json`, `kql-logs.json`, etc.)
- ❌ Change schema structures
- ❌ Delete cached or persisted data

---

## ⚠️ ASK IF UNCERTAIN (USE JUDGMENT)

### Code Changes
- ⚠️ Refactor existing working code (even if "improving" it)
- ⚠️ Change component props or interfaces
- ⚠️ Modify CSS that affects multiple components
- ⚠️ Add new React hooks or services
- ⚠️ Change state management patterns

### Configuration
- ⚠️ Modify `vite.config.ts`, `tsconfig.json`, or build configs
- ⚠️ Change linting or formatting rules
- ⚠️ Update package.json scripts

### Testing
- ⚠️ Skip manual testing for changes to critical features
- ⚠️ Modify test configuration

### Documentation
- ⚠️ Create new summary documents (unless explicitly requested)
- ⚠️ Make major changes to architecture docs

---

## ✅ OK TO DO AUTOMATICALLY (SAFE ACTIONS)

### Code Quality
- ✅ Fix TypeScript compilation errors
- ✅ Fix obvious bugs in new code
- ✅ Add missing imports
- ✅ Format code (indentation, spacing)

### Documentation
- ✅ Add inline code comments
- ✅ Update existing documentation for changes made
- ✅ Fix typos in comments or docs

### Investigation
- ✅ Read files to understand code
- ✅ Search codebase (grep, semantic search)
- ✅ Check git history
- ✅ Check server status (read-only commands)
- ✅ Run verification scripts (read-only)

### Logging & Debugging
- ✅ Add console.log statements for debugging
- ✅ Add error handling with user-friendly messages
- ✅ Improve existing logging

### Session Notes
- ✅ Update session notes with completed work
- ✅ Add TODOs to session notes
- ✅ Document learnings and decisions

---

## 🚨 SPECIAL RULES (CRITICAL - ALWAYS ENFORCE)

### Server Management
**NEVER use `run_in_terminal` with `isBackground: true` to start servers**
- Reason: Terminal reuse sends SIGINT, killing running processes
- Exception: NONE
- If servers need starting: Tell user to use `.\scripts\server-manager.ps1 start`

### Hot Reload Projects
**NEVER restart servers in projects with nodemon/Vite HMR**
- Reason: Hot reload handles changes automatically
- Exception: Only if user explicitly asks to restart
- If change doesn't hot-reload: Tell user, don't restart automatically

### Environment Files
**NEVER create `.env.local` from `.env.example`**
- Reason: `.env.example` has placeholders, `.env` has real values
- Correct: Copy from `.env` and modify only what's needed
- Better: Ask if `.env.local` is even necessary

### CSS Changes
**ALWAYS follow the 5-phase CSS protocol** (see copilot-instructions.md)
- Phase 1: Structure Analysis
- Phase 2: CSS Cascade Tracing
- Phase 3: Conflict Detection
- Phase 4: Multi-Level Analysis
- Phase 5: Solution Design
- **Announce each phase** as you work through it

### Production Deployment
**ALWAYS ask before deploying to production**
- Exception: Only deploy automatically if user explicitly says "deploy this", "push to prod", "deploy to Azure"
- After builds: Stop and ask "Ready to deploy to production?"

---

## Decision Framework

When unsure whether to ask or act:

1. **Will this change affect working code?** → ⚠️ Ask
2. **Could this break something if wrong?** → 🛑 Ask
3. **Is this a side effect of the main task?** → ⚠️ Ask
4. **Would the user expect this action?** → If no, 🛑 Ask
5. **Can this be easily undone?** → If no, 🛑 Ask

**When in doubt, ASK.**

---

## Examples of Good Judgment

### ✅ Good: Act Autonomously
```
User: "Fix the TypeScript error in Dashboard.tsx"
Action: Read file, identify error, fix it, done
```

### ✅ Good: Ask First
```
User: "Fix the TypeScript error in Dashboard.tsx"
Finding: Error is due to outdated interface, affects 5 components
Response: "The error is because UserData interface changed. Fix requires updating 5 components. Should I proceed?"
```

### ❌ Bad: Don't Assume
```
User: "The app is slow"
Action: Refactors entire codebase, adds caching, changes API patterns
Correct: Ask "What specifically is slow? I can investigate and propose solutions."
```

### ✅ Good: Explain Trade-offs
```
User: "Can we cache the API responses?"
Response: "Yes, we can cache with localStorage. Trade-offs:
- ✅ Faster subsequent loads
- ❌ Stale data until cache expires
- ⚠️ Need to handle cache invalidation
Should I implement with 5-minute TTL?"
```

---

## Enforcement

If you (Copilot) violate these rules:
- User may ask: "Are you following the approval matrix?"
- Response: Stop, acknowledge violation, ask for permission to proceed
- Update this document if rules need clarification

If rules are unclear or conflict:
- Ask user for clarification
- Suggest updating this document with the decision

---

**Bottom Line**: When uncertain, default to asking. User trust > autonomous action speed.
