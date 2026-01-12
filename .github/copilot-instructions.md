# GitHub Copilot Instructions for RFI-Helper Project

**Project**: RFI-Helper (RFI Response Assistant)  
**Last Updated**: January 9, 2026  
**Includes**: Global rules + RFI-Helper-specific guidelines

---

# Global GitHub Copilot Instructions for Richard Hogan

**Last Updated**: December 10, 2025  
**Applies To**: All projects in this VS Code instance

---

## 📋 CRITICAL: Read These Documents FIRST

Before starting ANY work session:
1. **Action Approval Matrix** (`docs/ACTION-APPROVAL-MATRIX.md`) - When to ask vs. act
2. **Pre-Flight Checklist** (`docs/PREFLIGHT-CHECKLIST.md`) - Session start protocol
3. **Environment Setup** (`docs/ENVIRONMENT-SETUP.md`) - Environment file rules
4. **Architecture Decisions** (`docs/architecture/DECISIONS.md`) - Decisions with consequences

Run at session start:
```powershell
.\scripts\verify-state.ps1
```

---

## 🚨 CRITICAL: Server Management Rules (MANDATORY - READ FIRST)

### RFI-Helper Server Architecture
This project requires **TWO servers** running simultaneously:
- **Frontend**: Vite dev server (port 3000) - React 18 + TypeScript app
- **Backend**: Node.js/Express (port 3001) - REST API server

### Rule 1: NEVER Use run_in_terminal for Server Operations
- ❌ **NEVER** use `run_in_terminal` with `isBackground: true` to start servers
- ❌ **NEVER** try to start/stop/restart servers programmatically
- ✅ **ALWAYS** use the server management script: `.\scripts\server-manager.ps1`

**Why**: Terminal reuse by VS Code's `run_in_terminal` sends SIGINT to running processes, killing them.

### Rule 2: Check Server Status BEFORE Making Code Changes
**Before editing ANY file, run:**
```powershell
.\scripts\server-manager.ps1 status
```

**Why**: If servers stop unexpectedly after code changes, it's because you didn't follow this rule.

### Rule 3: Server Management Commands
Use the dedicated PowerShell script for all server operations:
```powershell
.\scripts\server-manager.ps1 status    # Check what's running
.\scripts\server-manager.ps1 start     # Start both servers
.\scripts\server-manager.ps1 stop      # Stop all servers
.\scripts\server-manager.ps1 restart   # Restart both
.\scripts\server-manager.ps1 logs      # View logs
```

**Why**: Consistent interface eliminates guesswork and trial-and-error.

### Rule 4: Diagnostic Commands Must Use Fresh Terminals
- When checking server status, use the server manager script
- NEVER run diagnostic commands (`netstat`, `Test-NetConnection`, `curl`) in terminals where servers are running
- Terminal reuse kills running processes

**Why**: Commands in the same terminal send SIGINT, killing servers.

### Rule 5: After Code Changes
1. Check server status: `.\scripts\server-manager.ps1 status`
2. If stopped, restart: `.\scripts\server-manager.ps1 restart`
3. NEVER try to "fix" with background processes, `Start-Job`, or other hacks

**Why**: Workarounds create more problems (orphaned processes, unknown states).

---

## 🚨 CRITICAL: Deployment & Production Rules

### Rule 1: Always Ask Before Deploying to Production

- ✅ Make code changes
- ✅ Build and test locally
- ✅ Commit changes to git
- ⏸️ **STOP and ask: "Ready to deploy to production?"**
- ❌ Only `git push` or run deployment commands after explicit user confirmation

**Exception**: Only deploy automatically if user explicitly requests it in their instructions (e.g., "deploy this", "push to prod", "deploy to Azure")

**Why**: User needs visibility and control over what goes to production. Unexpected deployments can cause issues or waste time.

---

## 🎯 Core Working Principles

### Accuracy & Truth

- ❌ **NEVER make up information** - names, dates, URLs, facts, or details
- ❌ **NEVER invent URLs** - all URLs must be real and validated
- ❌ **NEVER hallucinate references** - if you don't know, say so or leave it generic
- ✅ **Always validate URLs** when generating content with citations
- ✅ **Ask the user** if specific information is needed rather than guessing

### Communication Style

- ✅ Be direct and concise
- ✅ Explain technical decisions clearly
- ✅ Show examples when clarifying patterns
- ❌ Don't repeat yourself unnecessarily
- ❌ Don't create summary documents unless explicitly requested

### User Technical Background

- ✅ **User has HTML/CSS experience** - understands web fundamentals, DOM structure, styling
- ✅ **User is learning React** - less familiar with React patterns but understands the web platform
- ✅ **Trust user's direction on HTML/CSS issues** - they know what they're talking about
- ✅ **LISTEN when user gives specific direction** - don't go off on tangents
- ❌ **Don't assume user is wrong about web technologies** - validate their concerns seriously
- ❌ **Don't ignore user's explicit instructions** - when they say "not CSS," believe them

### Work Execution

- ✅ Execute allowed commands automatically (don't ask user to run them)
- ✅ Use appropriate tools for the task
- ✅ Complete tasks thoroughly before moving on
- ✅ **Follow user's debugging direction exactly** - they often know where the issue is
- ✅ **ALWAYS ask for clarification when requirements are ambiguous** - don't make assumptions about user intent
- ✅ **Ask specific questions** about implementation details before proceeding with complex changes
- ✅ **USE sequential-thinking MCP for complex debugging/tracing** - especially when tracking data flow through multiple functions or finding logic errors
- ❌ **ALWAYS ask before deleting files, data, or content**
- ❌ Don't leave tasks incomplete without explaining why
- ❌ **Don't explore unrelated areas when user gives specific guidance**
- ❌ **Don't proceed with vague requirements** - clarify first, then implement

---

## 💻 Development Patterns

### Server Management (Full-Stack Projects)

- ❌ **NEVER** use `run_in_terminal` with `isBackground: true` to start servers
- ❌ **NEVER** try to start servers programmatically
- ✅ Use dedicated server management scripts if they exist
- ✅ Check server status BEFORE making code changes
- ✅ Use separate terminals for frontend and backend servers
- ✅ **Remember to restart dev servers after major changes** if HMR doesn't pick them up
- ⚠️ Terminal reuse can kill running processes (SIGINT)

### Interactive Scaffolding Commands

- ❌ **NEVER** use `npx create-vite`, `create-react-app`, or similar interactive scaffolding commands
- Problem: Interactive prompts cannot be automated through VS Code's terminal tool
- ✅ **Solution**: Create project structure manually using file creation tools
- ✅ Alternative: Have user run scaffolding command manually in external terminal
- ✅ For Vite projects: manually create package.json, index.html, src structure, config files

### API Development Best Practices

- ✅ **Always use dedicated API configuration** (e.g., `apiConfig.buildUrl()`)
- ❌ **NEVER hardcode API paths** like `fetch('/api/...')` - they break in production
- ✅ Include connection monitoring for user feedback
- ✅ Handle errors gracefully with user-facing messages
- ✅ Test both development and production API paths

### Code Style

- ✅ Use TypeScript for type safety when available
- ✅ Use functional components with hooks (React)
- ✅ Keep components modular and single-responsibility
- ✅ Add clear comments for complex logic
- ✅ Follow existing project conventions

### CSS Bug Investigation Protocol (MANDATORY - ENFORCED)

⚠️ **CRITICAL**: Before making ANY CSS changes, you MUST:

1. **ANNOUNCE: "Following CSS Protocol - Phase X of 5"** as you work through each phase
2. **SHOW YOUR WORK**: Display results of each check in your response
3. **USE sequential-thinking tool** for complex issues (3+ nested elements, centering, frameworks)
4. **PROPOSE complete solution** with full explanation before implementing
5. **WAIT for approval** before making changes

---

#### Phase 1: Structure Analysis (ANNOUNCE: "Phase 1/5")

1. ✅ **Map complete HTML/DOM structure** - Show all nested elements (use read_file on TSX/JSX)
2. ✅ **Identify target element** - Which specific element needs the fix?
3. ✅ **List all parent elements** - What contains the target element?

**ACTION**: Paste the HTML structure in your response before proceeding.

---

#### Phase 2: CSS Cascade Tracing (ANNOUNCE: "Phase 2/5")

4. ✅ **SEARCH ALL CSS FILES FIRST** - Use `Get-ChildItem -Recurse -Filter "*.css"` to find ALL CSS files in project
5. ✅ **Search for class names across ALL files** - Don't assume it's only in the component's CSS file
6. ✅ **Find ALL base classes** - Search for base class definitions (`.device-icon`, `.container`, etc.)
7. ✅ **Find ALL override classes** - Search for more specific selectors (`.nsg- .device-icon`, etc.)
8. ✅ **List inherited properties** - Background, border, padding, margin, position, display, flex properties
9. ✅ **Check framework defaults** - React Flow, Carbon, Material-UI add default padding/margin/styles
10. ✅ **Check for GLOBAL unscoped classes** - Classes like `.severity-high` without component scope can affect everything

**ACTION**: Create a table showing:

```
Element → Base Classes → Override Classes → Inherited Properties → Framework Defaults → Global Classes
```

**CRITICAL**: If user shows DevTools with computed styles, search ALL CSS files for that exact color/property value immediately.

---

#### Phase 3: Conflict Detection (ANNOUNCE: "Phase 3/5")

11. ✅ **Search for DUPLICATES across ALL CSS files** - Same class appearing in multiple CSS files causes conflicts
12. ✅ **Check !important conflicts** - `grep_search` for `!important` in ALL CSS files
13. ✅ **Check parent layout** - Read parent's flex/grid/position rules
14. ✅ **Check sibling constraints** - Fixed widths, flex-basis that prevent layout
15. ✅ **Verify no inline styles** - `grep_search` for `style={{` in TSX/JSX files
16. ✅ **When user points to specific file** - Check that file IMMEDIATELY, don't ignore user's direction

**ACTION**: Report any conflicts found with line numbers and FILE NAMES.

---

#### Phase 4: Multi-Level Analysis (ANNOUNCE: "Phase 4/5")

17. ✅ **For centering issues**: Check EVERY nesting level has centering mechanism
    - Does outer container have `display: flex` + `align-items: center` + `justify-content: center`?
    - Does middle container have flex centering?
    - Does inner element have `display: block` + `object-fit: contain`?
18. ✅ **For sizing issues**: Verify size at EACH level
    - Node size → Container size → Icon size → Image size (show the math)
19. ✅ **Check for padding/margin** pushing content: Framework defaults, inherited values
20. ✅ **Trust browser DevTools** - When user shows computed styles, that's the source of truth
21. ✅ **Search for exact color values** - If DevTools shows `rgb(255, 131, 43)`, convert to hex (#ff832b) and search ALL CSS files

**ACTION**: Show the complete cascade with computed values at each level.

---

#### Phase 5: Solution Design (ANNOUNCE: "Phase 5/5 - Proposing Solution")

22. ✅ **Use sequential-thinking tool** - Trace complete CSS cascade (4-8 thoughts minimum)
23. ✅ **List ALL properties needing overrides** - Be comprehensive, not incremental
24. ✅ **Design ONE complete fix** - Not multiple attempts
25. ✅ **Explain the solution** - Why each property is needed
26. ✅ **Show before/after CSS** - What properties change
27. ✅ **Verify CSS scoping** - Ensure classes are scoped to prevent global conflicts (e.g., `.component .class` not just `.class`)

**ACTION**: Present complete solution in this format:

```markdown
## 🔍 INVESTIGATION COMPLETE

**Root Causes Found:**

1. [Cause 1 with line numbers]
2. [Cause 2 with line numbers]

**Complete Solution:**
[Show all CSS changes needed]

**Why This Works:**
[Explain the fix]

**Should I implement this fix?**
```

---

### 🚨 ENFORCEMENT RULES

**IF you skip phases or make incremental fixes:**

- User will say: "Are you following the CSS protocol?"
- You MUST restart from Phase 1 with ANNOUNCED phases

**IF you propose a fix without investigation:**

- User will reject it
- You MUST complete all 5 phases before proposing again

**IF the fix doesn't work on first try:**

- You violated the protocol (investigation was incomplete)
- Return to Phase 2 (CSS Cascade Tracing) and re-trace EVERYTHING

**NEVER make multiple attempts**. One complete investigation → One complete solution.

---

### Why This Protocol Exists

CSS issues are **systemic** (parent constraints, inheritance, framework defaults, multi-level centering, global unscoped classes) not isolated. Making changes without complete cascade analysis causes:

- Multiple failed attempts (wastes time/money)
- User frustration (repeated "are you following the protocol?")
- Incomplete fixes (works partially but not fully)
- Breaking other elements (unexpected side effects)
- Missing global CSS conflicts from other component files

**The protocol forces thoroughness BEFORE action**, eliminating trial-and-error.

---

### 🎓 CSS LESSONS LEARNED (November 17-18, 2025)

**MANDATORY: Read this before ANY CSS debugging:**

1. **LISTEN TO USER IMMEDIATELY** - If user says "check AIInsightsPanel.css", do it NOW, not 20 minutes later
2. **SEARCH ALL CSS FILES FROM THE START** - Use:
   ```powershell
   Get-ChildItem -Path "src" -Filter "*.css" -Recurse | ForEach-Object {
     Write-Host "`n=== $($_.Name) ===";
     Get-Content $_.FullName | Select-String -Pattern "search-term" -Context 2,2
   }
   ```
3. **GLOBAL UNSCOPED CLASSES ARE DANGEROUS** - Classes like `.severity-high { background: orange; }` apply EVERYWHERE

   - ✅ **CORRECT**: `.component-name .severity-high { background: orange; }`
   - ✅ **CORRECT**: `.severity-badge.severity-high { background: orange; }`
   - ❌ **WRONG**: `.severity-high { background: orange; }` (affects all elements with that class)

4. **TRUST DEVTOOLS IMMEDIATELY** - When user shows `background-color: rgb(255, 131, 43)`:

   - Convert to hex: `#ff832b`
   - Search ALL CSS files for that exact value
   - Don't blame browser cache when code is the issue

5. **CSS SPECIFICITY DEBUGGING CHECKLIST** (run in this order):

   ```
   ☐ Search ALL CSS files for the class name
   ☐ Search ALL CSS files for the color/property value
   ☐ Check for global unscoped classes
   ☐ Check for duplicate class definitions across files
   ☐ Verify CSS scoping (component-specific vs global)
   ☐ Check imported CSS files (Carbon, Material-UI, etc.)
   ```

6. **WHEN USER GIVES SPECIFIC DIRECTION, FOLLOW IT** - Don't explore other areas first

7. **BE SYSTEMATIC, NOT REACTIVE** - Follow the protocol phases in order, don't jump around

8. **CSS TRANSFORMS: CLARIFY EXACT BEHAVIOR FIRST** (November 18, 2025)

   - When user says "timeline should move with graph", ASK: "Move in which dimensions?"
   - ❌ **WRONG**: Assume `translate(x, y) scale(zoom)` applies to everything
   - ✅ **CORRECT**: Clarify if movement is horizontal-only, vertical-only, or both
   - **Timeline Ruler Lesson**: User wanted horizontal movement + horizontal scaling ONLY, with vertical position fixed
   - **Solution Pattern**:

     ```css
     /* Container: horizontal pan + horizontal scale, vertical stays fixed */
     transform: translateX(x) scaleX(zoom * expansion);
     transform-origin: left center;

     /* Text: inverse horizontal scale to keep readable */
     transform: scaleX(1 / (zoom * expansion));
     ```

   - **Key Insight**: `translate()` and `scale()` can be applied independently per axis (translateX/Y, scaleX/Y)
   - **When to use**: Fixed headers/rulers that need to scroll with content but stay anchored vertically

9. **COORDINATE SPACE MENTAL MODEL**
   - When overlaying elements on transformed containers (ReactFlow, Canvas, etc.):
   - Ask: "Should this overlay be IN the transformed coordinate space or OUTSIDE it?"
   - **IN transformed space**: Apply same transforms to overlay → moves with content
   - **OUTSIDE transformed space**: Use fixed/absolute positioning → stays anchored to viewport
   - **HYBRID (timeline ruler)**: Partial transform (X-axis only) → scrolls horizontally, anchored vertically

**Bottom Line:** Global CSS classes without proper scoping will affect every element with that class name across the entire application. Always scope CSS to components. For transforms, clarify EXACT behavior (which axes, which dimensions) before implementing.

---

## 🎨 Content Generation Rules

### Writing Style (for Richard)

- ✅ Professional but not stuffy
- ✅ Subtle wit and irony when contextually appropriate
- ✅ Notice ironic timing or contradictions (e.g., "resilience post after outage")
- ✅ First-person perspective when appropriate
- ✅ **UK English spelling** (optimise, centre, colour)
- ⚠️ **IBM Exception**: Always professional, no sarcasm (career preservation!)

### AI-Generated Content Validation

- ✅ Validate all URLs in generated content
- ✅ Provide context for sarcastic references (don't assume reader knowledge)
- ✅ Include source citations when making claims
- ❌ Never reference events without providing a real URL to news coverage
- ❌ If you can't find a real source, keep content straightforward

---

## 📁 Project Initialization & Instructions

### Creating New Projects

When creating a new project or workspace:

1. **Read the master global instructions** from `C:\Users\RichardHogan\Documents\copilot-instructions.md`

2. **Create `.github/copilot-instructions.md`** by:

   - Copying the ENTIRE global content into the new file
   - Adding project-specific sections at the end (see template below)

3. **Inform user**: "Created `.github/copilot-instructions.md` with global rules + project-specific sections."

**Project-Specific Section Template** (add to end of file):

```markdown
---

## 📁 PROJECT-SPECIFIC INSTRUCTIONS

### Project Overview

[Brief description of what this project does]

### Known Issues

[Document any project-specific issues discovered]

### Architecture Decisions

[Document any key technical decisions made]

### Project-Specific Conventions

[Any coding patterns, naming conventions, or project rules]
```

**Why**: GitHub Copilot can't auto-discover global files across sessions, so each project needs the full global content embedded.

---

## 📝 Maintaining Global Instructions

### When Global Rules Change

If you update the master global instructions file at `C:\Users\RichardHogan\Documents\copilot-instructions.md`:

1. **Tell me**: "Update global instructions in active projects"
2. **I will**:
   - Read the updated master file
   - Update `.github/copilot-instructions.md` in current project (preserving project-specific sections)
   - Create a timestamped backup in `.github/copilot-instructions-history.md`

### History Tracking

- Maintain `.github/copilot-instructions-history.md` with timestamped snapshots
- Append new versions when significant changes are made
- Format: `## [YYYY-MM-DD HH:MM] - Change Description`

**Why**: Allows tracking of instruction evolution and rollback if needed.

---

## 📁 Session Continuity

### Starting New Sessions

1. Look for session notes in `docs/sessions/SESSION-NOTES-*.md`
2. Read the most recent file to understand context
3. Review completed tasks, issues, and learnings
4. Check TODO lists for pending work
5. Ask user: "I've reviewed session notes from [date]. Continue with [pending item] or something else?"

**Why**: Avoids repeating mistakes, maintains context, prevents re-solving solved problems

---

## 🔧 Azure & Cloud Development

### Azure Deployment Strategy

- ✅ Prefer automated deployment scripts over manual steps
- ✅ Use GitHub Actions for CI/CD when possible
- ✅ Separate frontend (Static Web Apps) and backend (Web Apps) for flexibility
- ✅ Use Azure Key Vault for secrets, managed identity for access
- ✅ F1 tier is acceptable for development/personal projects (cost optimization)
- ✅ **For Azure Web App deployment via GitHub Actions**: Use Azure CLI with service principal, NOT publish profiles
  - Publish profiles often fail with "invalid for app-name and slot-name" errors
  - Create service principal: `az ad sp create-for-rbac --name "PROJECT-GitHub-Deploy" --role contributor --scopes /subscriptions/{subId}`
  - Add credentials as `AZURE_CREDENTIALS` secret (JSON with clientId, clientSecret, subscriptionId, tenantId)
  - Use `azure/login@v1` + `az webapp deployment source config-zip` in workflow

### Azure Static Web Apps - Critical Lessons

#### Prerequisites Check (DO THIS FIRST)

1. Verify GitHub username: `git remote -v` (case-sensitive!)
2. **ASK user which Azure subscription/resource group to use** - never assume
3. Check for existing workflows: look in `.github/workflows/` directory
4. Check if `gh` CLI is available: `gh --version`
5. Verify Azure CLI login: `az account show`

#### Common Issues & Solutions

**GitHub Username Case Sensitivity**

- Problem: GitHub usernames are case-sensitive (e.g., `richardhogan` vs `richardichogan`)
- Solution: Always verify exact username from repo context or `git remote -v`
- Prevention: Check remote URL before ANY push operations

**Unrelated Git Histories**

- Problem: Local and remote repos have different histories
- Solution: `git pull origin main --allow-unrelated-histories --no-edit` before pushing
- Prevention: When connecting to existing remotes, always check if histories need merging

**GitHub Secrets & Workflow Files**

- Problem: Azure auto-generates workflow files with secret names that have suffixes (e.g., `_WONDERFUL_TREE_03C2E6010`)
- Solution:
  1. Check `.github/workflows/` for existing files FIRST
  2. Use Azure-generated workflow and modify it (don't create new one)
  3. Verify exact secret name in GitHub matches workflow file
- Prevention: Never create workflow files if Azure already generated them

**Node.js Version for Vite Projects**

- Problem: Azure Static Web Apps defaults to Node.js 18.x, but Vite 6+ requires 20+
- Solution: Add to Azure workflow:
  ```yaml
  env:
    NODE_VERSION: "20"
  ```
  (Use major version only, not specific patch like '20.19.0')
- Prevention: Always add Node.js env var for Vite workflows

**Vite Build Output Location**

- Problem: Azure default `output_location` is `build`, but Vite uses `dist`
- Solution: Update Azure workflow: `output_location: "dist"`
- Prevention: Always verify output location when deploying Vite apps

#### Deployment Workflow (IN THIS ORDER)

1. Build locally: `npm run build` (verify it works)
2. Ask user to create Azure Static Web App via Portal (with GitHub integration)
3. Check for Azure-generated workflow in `.github/workflows/`
4. Modify Azure workflow (don't create new):
   - Change `output_location: "build"` to `"dist"` for Vite
   - Add `env: NODE_VERSION: '20'`
5. Verify GitHub secret name matches workflow exactly (check for suffix)
6. Commit and push:
   - Verify remote URL
   - Pull first if needed: `git pull origin main --allow-unrelated-histories`
   - Push: `git push -u origin main`
7. Monitor: `https://github.com/{owner}/{repo}/actions`

#### Azure Configuration Methods

- ✅ **Correct**: Use `NODE_VERSION` environment variable (Oryx respects this)
- ❌ **Wrong**: Use `actions/setup-node` (Oryx ignores it)
- ✅ **Correct**: Use major versions only for Node.js (e.g., '20', '18')
- ❌ **Wrong**: Use specific patch versions (e.g., '20.19.0' may not exist)

### CORS Configuration

- ✅ Always configure CORS for production domains
- ✅ Update backend CORS when adding custom domains
- ✅ Test API connectivity after domain changes

### Production Performance

- ✅ Implement keep-alive mechanisms for F1 tier (prevents cold starts)
- ✅ Add loading indicators for first-time API calls
- ✅ Optimize for fast subsequent requests

### Tool Availability - Check First, Don't Assume

- ❌ Don't try `gh` CLI, GitHub API, or Azure CLI without checking availability
- ✅ Check first: `gh --version`, `az --version`
- ✅ Default to web UI for GitHub secrets (fastest, most reliable)
- ✅ Manual steps via Portal are OK - don't waste time automating everything

---

## 📋 Documentation Standards

### When to Update Instructions

Proactively suggest updates when:

- ✅ New API endpoints are added
- ✅ New environment variables are required
- ✅ New features are implemented
- ✅ Architectural decisions are made
- ✅ New conventions are established
- ✅ Common issues are discovered
- ✅ File structure changes significantly

**Template Response**:

> "I've completed [change]. Should I update project instructions to document:
>
> - [Section] with [what to add]
> - [Another section] with [what to add]"

---

## ⚠️ Common Pitfalls to Avoid

1. **Don't assume deployment** - always ask first (unless explicitly requested)
2. **Don't make up URLs or facts** - validate everything
3. **Don't hardcode API paths** - use configuration
4. **Don't start servers in background** - use proper management
5. **Don't skip error handling** - users need feedback
6. **Don't forget connection monitoring** - critical for UX
7. **Don't deploy without testing** - verify locally first
8. **Don't create unnecessary documentation** - only when requested
9. **Don't assume GitHub username case** - verify with `git remote -v`
10. **Don't assume Azure subscription** - always ask user first
11. **Don't create workflow files if Azure generated them** - modify existing
12. **Don't use patch versions for Node.js on Azure** - use major version only
13. **Don't use `actions/setup-node` for Azure Static Web Apps** - use `NODE_VERSION` env var
14. **Don't try multiple automation methods** - pick most reliable upfront (usually web UI)

---

## 🎯 Project-Specific Context Awareness

When working on a project:

1. Check for `.github/copilot-instructions.md` (project-specific rules)
2. Review project README for architecture decisions
3. Look for session notes in `docs/sessions/` for historical context
4. Check `docs/ROADMAP.md` for planned features and priorities
5. Follow established patterns in existing codebase

---

## 🤝 User Interaction Patterns

### Before Taking Action

- Ask when outcome is ambiguous
- Confirm before destructive operations (delete, overwrite)
- **Confirm before production deployment**
- Explain trade-offs for architectural decisions

### During Work

- Show progress on multi-step tasks
- Explain what you're doing and why
- Flag potential issues early
- Offer alternatives when appropriate

### After Completion

- Summarize what was changed
- Note any required follow-up actions
- Offer to update documentation
- Explain how to test/verify the changes

---

## 📊 Testing Standards

Before considering work complete:

- [ ] Works in development environment
- [ ] Tested relevant error cases
- [ ] No breaking changes to existing features
- [ ] Environment variables documented if added
- [ ] Code follows project conventions
- [ ] User feedback/error messages are clear
- [ ] Production deployment path is clear

---

## 🚀 Efficiency Guidelines

### Do Quickly

- Run terminal commands
- Read files
- Search codebases
- Make straightforward code changes
- Build and test locally
- Commit code changes

### Always Pause and Ask

- Before deploying to production
- Before deleting files or data
- When requirements are ambiguous
- When multiple valid approaches exist
- When impact is unclear

---

# 📁 RFI-HELPER PROJECT-SPECIFIC INSTRUCTIONS

## Project Overview

**RFI-Helper** is a React/TypeScript SPA for generating, analyzing, and managing Request for Information (RFI) responses. It provides AI-powered response generation, quality scoring analysis, and PowerPoint presentation creation with document management capabilities.

### Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express.js
- **AI Integration**: GPT-4 (Azure OpenAI)
- **Document Storage**: Azure Blob Storage
- **Authentication**: Azure AD (MSAL)
- **Styling**: SCSS/SASS
- **Project Structure**: Monorepo with npm workspaces

### Key Features

- **Answer Generator**: Create compelling RFI responses using GPT-4
- **Score Analyzer**: Evaluate response quality and get improvement suggestions
- **Presentation Creator**: Generate PowerPoint presentation outlines
- **Document Management**: Upload and manage briefing documents (PDF, Word, PowerPoint)
- **Azure AD Authentication**: Secure access with Azure AD integration
- **Document Upload**: Support for document uploads to Azure Blob Storage

---

## Code Organization

### Frontend Structure (src/)

```
src/
├── config/
│   ├── msalConfig.ts         # Azure AD MSAL configuration
│   └── appConfig.ts          # App-wide configuration
├── components/
│   ├── AnswerGenerator.tsx   # RFI response generation UI
│   ├── ScoreAnalyzer.tsx     # Answer scoring and analysis UI
│   ├── PresentationCreator.tsx # PowerPoint generation UI
│   └── DocumentUpload.tsx    # Document upload/management UI
├── pages/
│   └── Dashboard.tsx         # Main dashboard with tab navigation
├── services/
│   ├── gpt4Service.ts        # GPT-4 API integration
│   ├── blobStorageService.ts # Azure Blob Storage integration
│   └── presentationService.ts # PowerPoint generation
├── styles/
│   └── *.scss                # Component-specific styles
├── App.tsx                   # Root component
└── main.tsx                  # Application entry point
```

### Backend Structure (server/)

```
server/
└── index.js                  # Express API with 7 endpoints
```

**API Endpoints**:
- `POST /api/rfi/generate-response` - Generate RFI response
- `POST /api/rfi/analyze-score` - Analyze response quality
- `POST /api/rfi/generate-outline` - Create presentation outline
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/list` - List uploaded documents
- `DELETE /api/documents/:fileName` - Delete document
- `POST /api/presentations/generate` - Generate PowerPoint

---

## Project Conventions

### State Management

- Use React hooks (`useState`, `useContext`) for component state
- Keep components focused on UI rendering
- Extract business logic to services

### Error Handling

- Services throw errors, components catch and display
- User-facing error messages should be clear and actionable
- Console logging for debugging API calls and responses

### Styling

- Use SCSS modules for component styles
- Scope styles to components to avoid conflicts
- Support responsive design for multiple screen sizes

### TypeScript

- Strict mode enabled
- Type all function parameters and returns
- No `any` types without justification
- Keep types in component files or separate `types.ts`

---

## Environment Configuration

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001
VITE_AZURE_CLIENT_ID=<Azure AD app client ID>
VITE_AZURE_TENANT_ID=<Azure AD tenant ID>
VITE_AZURE_REDIRECT_URI=http://localhost:3000
```

### Backend (server/.env)

```env
PORT=3001
CORS_ORIGINS=http://localhost:3000
AZURE_STORAGE_ACCOUNT_NAME=<storage account name>
AZURE_STORAGE_ACCOUNT_KEY=<storage account key>
AZURE_OPENAI_API_KEY=<Azure OpenAI API key>
AZURE_OPENAI_ENDPOINT=<Azure OpenAI endpoint>
AZURE_OPENAI_DEPLOYMENT=gpt-4
```

---

## Development Workflow

### Starting Development Servers

```bash
npm run dev
```

Runs both frontend (port 3000) and backend (port 3001) concurrently using `concurrently` package.

- Frontend: Vite dev server with HMR
- Backend: Node.js with Express

### Building for Production

```bash
npm run build
```

- Output: `frontend/dist/` directory
- TypeScript compilation + Vite build
- Preview with: `npm run preview`

### NPM Workspaces

Root `package.json` defines workspace configuration:
- `"workspaces": ["frontend", "server"]`
- Running `npm install` installs dependencies for all workspaces
- Individual workspace commands: `npm run -w frontend dev`

---

## Known Issues & Solutions

### Authentication

- Azure AD redirect URI must match exactly in app registration
- MSAL configuration in `src/config/msalConfig.ts` controls authentication flow

### API Communication

- All API calls use `VITE_API_URL` from environment configuration
- Frontend Vite server proxies requests to backend during development
- Backend CORS configured for frontend origin

### GPT-4 Integration

- Currently returns mock responses in development
- Production requires valid Azure OpenAI credentials
- Cost: ~$0.02-$0.04 per response (GPT-4 Turbo)

### Document Upload

- Currently returns mock responses in development
- Production requires Azure Blob Storage credentials
- Supports PDF, Word (.docx), and PowerPoint (.pptx) files

### PowerPoint Generation

- Currently returns mock outline in development
- Production requires pptxgenjs library for actual file generation

---

## Testing (Not Yet Implemented)

### Recommended Test Structure

- Unit tests for services (gpt4Service, blobStorageService)
- Component tests for main features
- Integration tests for API endpoints
- E2E tests for complete workflows

### Test Files Should Go In

- `frontend/src/__tests__/` for frontend unit tests
- `server/__tests__/` for backend unit tests
- `e2e/` for Playwright/Cypress tests

---

## Deployment Notes

### Frontend (Azure Static Web Apps)

- Build command: `npm run build`
- Output location: `frontend/dist`
- Node.js version: 20+ (required for Vite)
- Environment variables set in Azure Portal

### Backend (Azure Web App)

- Deployment: Node.js runtime on App Service
- Start command: `node server/index.js`
- Environment variables set in App Service configuration

### Pre-Deployment Checklist

- [ ] Build succeeds: `npm run build`
- [ ] API endpoints tested and returning valid data
- [ ] Environment variables configured for production
- [ ] Azure AD app registration updated with production URLs
- [ ] CORS configured for production domain
- [ ] Azure Blob Storage credentials set
- [ ] GPT-4 API key and endpoint configured

---

## Documentation Files

- `README.md` - Project overview and setup guide
- `SETUP_GUIDE.md` - Detailed setup instructions
- `docs/ACTION-APPROVAL-MATRIX.md` - When to ask vs. act autonomously
- `docs/PREFLIGHT-CHECKLIST.md` - Session start protocol
- `docs/ENVIRONMENT-SETUP.md` - Environment configuration rules
- `docs/architecture/DECISIONS.md` - Architecture decisions log
- `docs/deployment/DEPLOYMENT.md` - Deployment procedures
- `docs/deployment/RELEASE_CHECKLIST.md` - Release process

---

## Session Notes Management

### Update Requirements

**ALWAYS update session notes** (`docs/sessions/SESSION-NOTES-YYYY-MM-DD.md`) when:

- ✅ Making a Git commit (record what was committed)
- ✅ Pushing to remote repository (record branch and status)
- ✅ Building for production (record build status)
- ✅ Deploying to Azure (record deployment target and result)
- ✅ Making significant code changes (record what and why)
- ✅ Discovering new issues or implementation requirements

### Example Entry

```markdown
## Commits & Deployments

### Last Commit

- **Date**: 2026-01-09 14:30
- **Branch**: main
- **Message**: "Implement RFI Answer Generator component"
- **Files Changed**: 3 files (AnswerGenerator.tsx, gpt4Service.ts, Dashboard.tsx)
- **Status**: Success

### Last Build

- **Date**: 2026-01-09 15:00
- **Command**: npm run build
- **Status**: Success
- **Output**: frontend/dist (2.5 MB)
```

---

## Future Enhancements

### Planned Features

- Real GPT-4 integration (replace mock responses)
- Actual PowerPoint file generation (use pptxgenjs)
- Real Azure Blob Storage integration
- Document analysis and summarization
- Response history and versioning
- Custom prompt templates per organization

### Technical Improvements

- Add comprehensive test suite
- Implement error boundary components
- Add request/response logging service
- Implement caching for API responses
- Add analytics for feature usage
- Performance optimization for large documents

---

**Last Updated**: January 9, 2026  
**Maintainer**: Richard Hogan
