# Complete Setup Guide

**From GitHub Template → Working Project in VS Code**

This guide walks you through creating a new project from this template, customizing it, and getting it running locally.

---

## Part 1: Publishing the Template (One-Time Setup)

If you're the template maintainer, do this once:

### 1.1 Create the Template Repository in GitHub

1. Go to GitHub and create a new repository (e.g., `enterprise-react-node-template`)
2. Clone it locally:
   ```powershell
   cd C:\Users\YourName\Development
   git clone https://github.com/<your-org>/enterprise-react-node-template.git
   cd enterprise-react-node-template
   ```
3. Copy the template contents:
   ```powershell
   # From the ACRE repo templates folder
   Copy-Item -Path "C:\path\to\ACRE\templates\new-project\*" -Destination . -Recurse
   ```
4. Commit and push:
   ```powershell
   git add .
   git commit -m "Initial template setup"
   git push origin main
   ```

### 1.2 Mark as Template Repository

1. Go to your repo on GitHub: `https://github.com/<your-org>/enterprise-react-node-template`
2. Click **Settings** (top right)
3. Scroll to **Template repository** section
4. Check the box: ☑ **Template repository**
5. Save

✅ **Done!** The green "Use this template" button now appears on your repo.

---

## Part 2: Creating a New Project from Template

### 2.1 Use the Template in GitHub

1. Go to the template repo: `https://github.com/<your-org>/enterprise-react-node-template`
2. Click the green **"Use this template"** button (top right)
3. Select **"Create a new repository"**
4. Fill in:
   - **Repository name**: e.g., `customer-portal`
   - **Description**: e.g., "Customer self-service portal"
   - **Visibility**: Public or Private
5. Click **"Create repository"**

✅ GitHub creates a new repo with all template files copied.

### 2.2 Clone Your New Project

```powershell
cd C:\Users\YourName\Development
git clone https://github.com/<your-org>/customer-portal.git
cd customer-portal
```

---

## Part 3: Customize the Project

### 3.1 Run Setup Script

The setup script prompts for your values and replaces all placeholders automatically:

```powershell
.\scripts\setup.ps1
```

**You'll be asked for:**
- **App name**: `customer-portal`
- **GitHub org/username**: `mycompany`
- **Frontend port**: `3000` (default, press Enter)
- **API port**: `3001` (default, press Enter)
- **Project variant**: 
  - `frontend-only` (React/Vite only, no API)
  - `api-only` (Node/Express only, no frontend)
  - `full-stack` (both, with Vite dev proxy enabled)

**Example run:**
```
🚀 Project Setup Wizard
=====================

Enter your project details:
App name (e.g., my-awesome-app): customer-portal
GitHub org/username (e.g., mycompany): mycompany
Frontend port (default: 3000): 
API port (default: 3001): 
Project variant (frontend-only / api-only / full-stack): full-stack

📝 Configuration:
  App Name: customer-portal
  Org: mycompany
  Frontend Port: 3000
  API Port: 3001
  Variant: full-stack

Proceed? (y/n): y

🔄 Replacing placeholders...
  ✓ Created: frontend/package.json
  ✓ Created: frontend/vite.config.ts
  ... (all .tmpl files processed)

🎯 Configuring for full-stack variant...
  ✓ Dev proxy enabled

📄 Creating .env files...
  ✓ Created frontend/.env
  ✓ Created server/.env (PORT=3001)

📦 Install dependencies now? (y/n): y
  Installing frontend dependencies...
  Installing API dependencies...

✅ Setup complete!
```

**What the script does:**
- Replaces all `<APP_NAME>`, `<ORG>`, `<FRONTEND_PORT>`, `<API_PORT>` placeholders
- Renames `.tmpl` files to actual files (e.g., `vite.config.ts.tmpl` → `vite.config.ts`)
- Removes folders you don't need (based on variant)
- Creates `.env` files from examples
- Optionally installs npm dependencies

### 3.2 Manual Customization (Optional)

Edit `.env` files if needed:

**frontend/.env:**
```bash
# Production API base URL (leave empty for dev proxy)
VITE_API_BASE_URL=
```

**server/.env:**
```bash
PORT=3001
CORS_ORIGINS=http://localhost:3000
# Add your API keys, database URLs, etc.
```

---

## Part 4: Open in VS Code

### 4.1 Open Project

```powershell
code .
```

Or: File → Open Folder → Select `customer-portal`

### 4.2 Verify Structure

You should see:
```
customer-portal/
├── .github/workflows/     # CI and optional Azure deploys
├── docs/                  # Checklists, deployment guides
├── frontend/              # React/Vite app
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── .env
├── server/                # Express API (if full-stack/api-only)
│   ├── index.js
│   ├── package.json
│   └── .env
├── scripts/
│   ├── server-manager.ps1
│   └── verify-state.ps1
└── README.md
```

### 4.3 Install VS Code Extensions (Recommended)

- **ESLint** (dbaeumer.vscode-eslint)
- **Prettier** (esbenp.prettier-vscode)
- **PowerShell** (ms-vscode.powershell)
- **Azure Tools** (ms-vscode.vscode-node-azure-pack) — if using Azure

---

## Part 5: Run the Project

### 5.1 Verify State

```powershell
.\scripts\verify-state.ps1
```

This checks:
- Node version >= 20
- .env files exist
- Ports are available

### 5.2 Start Development Servers

**Option A: Frontend-Only**
```powershell
cd frontend
npm run dev
```
→ Open http://localhost:3000

**Option B: API-Only**
```powershell
cd server
npm run dev
```
→ API running on http://localhost:3001

**Option C: Full-Stack (Recommended)**

Use the server manager script:
```powershell
.\scripts\server-manager.ps1 start
```

Or manually in separate terminals:
```powershell
# Terminal 1 - Frontend
cd frontend
npm run dev

# Terminal 2 - API
cd server
npm run dev
```

**Dev proxy** (full-stack only): Frontend requests to `/api/*` auto-proxy to `http://localhost:3001/api/*`

### 5.3 Check Server Status

```powershell
.\scripts\server-manager.ps1 status
```

### 5.4 Restart After Code Changes

If hot module reload (HMR) doesn't pick up changes:
```powershell
.\scripts\server-manager.ps1 restart
```

---

## Part 6: Make It Your Own

### 6.1 Update Docs

Edit these files to match your project:
- **README.md**: Project-specific description, setup, usage
- **docs/ENVIRONMENT-SETUP.md**: Your environment variables
- **docs/architecture/DECISIONS.md**: Your architectural decisions
- **.github/copilot-instructions.md**: Project-specific rules for Copilot

### 6.2 Add Features

- **Frontend**: Edit `frontend/src/App.tsx` and add components
- **API**: Add routes in `server/index.js` or create `server/routes/` folder
- **Styling**: Add CSS framework (Carbon, Material-UI, Tailwind, etc.)
- **Testing**: Add tests in `frontend/src/__tests__/` and `server/__tests__/`

### 6.3 Configure Azure (Optional)

If deploying to Azure, follow `docs/deployment/DEPLOYMENT.md`:

1. **Create Azure Resources:**
   - Static Web App (frontend) via Portal
   - Web App (API, Linux, Node 20) via Portal

2. **Add GitHub Secrets:**
   - `AZURE_CREDENTIALS` (Service Principal JSON)
   - `AZURE_SUBSCRIPTION_ID`
   - `RESOURCE_GROUP`
   - `WEBAPP_NAME`

3. **Enable Workflows:**
   - `.github/workflows/swa-deploy.yml` (frontend)
   - `.github/workflows/webapp-deploy.yml` (API)
   
   Change trigger from `workflow_dispatch` to `push: branches: [main]` when ready.

4. **Test Deployment:**
   - Go to Actions tab in GitHub
   - Run workflow manually first
   - Verify app works in Azure

---

## Part 7: Daily Development Workflow

### Typical Session

1. **Start:**
   ```powershell
   .\scripts\verify-state.ps1           # Sanity check
   .\scripts\server-manager.ps1 status  # What's running?
   .\scripts\server-manager.ps1 start   # Start both servers
   ```

2. **Code:**
   - Make changes in `frontend/src/` or `server/`
   - Hot reload should update automatically

3. **After Big Changes:**
   ```powershell
   .\scripts\server-manager.ps1 status   # Check servers
   .\scripts\server-manager.ps1 restart  # If needed
   ```

4. **Before Committing:**
   ```powershell
   cd frontend
   npm run build    # Verify frontend builds
   npm test         # Run tests
   
   cd ../server
   npm test         # Run API tests
   ```

5. **Commit & Push:**
   ```powershell
   git add .
   git commit -m "feat: add customer search"
   git push origin main
   ```
   → CI runs automatically (GitHub Actions)

---

## Part 8: Deployment

### Deploy to Production

**Never auto-deploy!** Always follow this sequence:

1. **Build & Test Locally:**
   ```powershell
   cd frontend
   npm run build
   npm test
   ```

2. **Commit Changes:**
   ```powershell
   git add .
   git commit -m "feat: new feature"
   ```

3. **Ask User Before Push:**
   > "Ready to push and deploy to production?"

4. **Push Only After Approval:**
   ```powershell
   git push origin main
   ```

5. **Monitor Deployment:**
   - Go to GitHub Actions tab
   - Watch CI and deploy workflows
   - Verify app works in production

**Read**: `docs/deployment/RELEASE_CHECKLIST.md` for full checklist.

---

## Troubleshooting

### Servers Won't Start

```powershell
# Check what's using the ports
netstat -ano | findstr "3000 3001"

# Kill processes if needed (get PID from above)
Stop-Process -Id <PID> -Force

# Restart
.\scripts\server-manager.ps1 restart
```

### HMR Not Working

- Restart dev server: `.\scripts\server-manager.ps1 restart`
- Check for syntax errors in console
- Clear browser cache (Ctrl+Shift+R)

### Build Fails

```powershell
# Clear node_modules and reinstall
cd frontend
Remove-Item -Recurse -Force node_modules
npm install

cd ../server
Remove-Item -Recurse -Force node_modules
npm install
```

### CORS Errors

Check `server/.env`:
```bash
CORS_ORIGINS=http://localhost:3000
```

In production, add your Static Web App domain:
```bash
CORS_ORIGINS=https://your-app.azurestaticapps.net
```

---

## Summary Cheat Sheet

```powershell
# One-time setup after template use
.\scripts\setup.ps1

# Daily workflow
.\scripts\verify-state.ps1
.\scripts\server-manager.ps1 status
.\scripts\server-manager.ps1 start

# After code changes
.\scripts\server-manager.ps1 restart

# Before commit
cd frontend && npm run build && npm test
cd ../server && npm test

# Deploy (ask user first!)
git push origin main
```

---

## Next Steps

1. Read: `docs/PREFLIGHT-CHECKLIST.md`
2. Review: `docs/ACTION-APPROVAL-MATRIX.md` (when to ask vs. act)
3. Customize: `.github/copilot-instructions.md` for your project
4. Start coding!

**Questions?** Check `docs/` folder or README.md in each component.

Happy building! 🚀
