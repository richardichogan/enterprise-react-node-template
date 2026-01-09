# Enterprise React/Node Template (Tooling-Only)

This template captures reusable scaffolding from ACRE, without any domain data. It standardizes docs, guardrails, configs, and optional Azure deploys so new projects start fast and safely.

## Variants
- Frontend-only: React/Vite + TypeScript (+ optional Azure Static Web Apps deploy)
- API-only: Node/Express (+ optional Azure Web Apps deploy)
- Full-stack: Vite frontend + Express API; dev proxy only here; deploy frontend to SWA and API to Web App

## Parameters (replace all placeholders)
- <APP_NAME>
- <ORG>
- <FRONTEND_PORT:3000>
- <API_PORT:3001>
- <ENV_VARS> (project-specific)
- <AZURE_SUBSCRIPTION_ID>
- <RESOURCE_GROUP>
- <SWA_NAME>
- <WEBAPP_NAME>
- <TENANT_ID>
- <CLIENT_ID>
- <CLIENT_SECRET>

## Guardrails
- Use scripts/server-manager.ps1 for start/stop/status/restart/logs. Do not run servers in reused/background terminals.
- Check status before edits; restart after impactful changes.
- Centralize API base URL; never hardcode `/api` for production.
- Dev vs prod CORS: dev allows `http://localhost:<FRONTEND_PORT>`; prod origins must be explicit.
- Node 20 for Vite builds and API runtime; Vite output to `dist`.
- Prefer modifying Azure-generated workflows over adding duplicates.

## Folder Map (template)
- frontend/ … Vite app (TS) with Vitest and basic styles
- server/ … Express API with CORS + `/healthz`
- scripts/ … server-manager.ps1, verify-state.ps1
- .github/workflows/ … CI, SWA deploy (optional), Web App deploy (optional)
- docs/ … ENVIRONMENT-SETUP, PREFLIGHT-CHECKLIST, ACTION-APPROVAL-MATRIX, DECISIONS, DEPLOYMENT, RELEASE_CHECKLIST

## Quick Start
1) Click "Use this template" in GitHub → "Create a new repository"
2) Clone your new repo locally
3) Run setup script to replace placeholders: `.\scripts\setup.ps1`
4) Install and run locally:
   - Frontend
     - `cd frontend`
     - `npm install`
     - `npm run dev`
   - API (optional)
     - `cd server`
     - `npm install`
     - `npm run dev`
4) Use scripts/server-manager.ps1 (status/start/stop/restart/logs) to manage both.

## Environment
- frontend/.env.example: `VITE_API_BASE_URL` (prod only)
- server/.env.example: `PORT`, `CORS_ORIGINS`, and <ENV_VARS>

## GitHub Actions
- CI: `.github/workflows/ci.yml.tmpl` — Node 20, frontend build/test, API lint/test
- SWA deploy (optional): `.github/workflows/swa-deploy.yml.tmpl` — `output_location: dist`, `NODE_VERSION: '20'`
- Web App deploy (optional): `.github/workflows/webapp-deploy.yml.tmpl` — Service Principal (`AZURE_CREDENTIALS`) + `config-zip`

Enablement:
- Keep deploy workflows as `workflow_dispatch` until validated.
- Create Service Principal and add `AZURE_CREDENTIALS` secret (`--sdk-auth`).
- For SWA created via Portal, prefer the Azure-generated workflow and secret name.

## Dev Proxy (full-stack only)
- Configure Vite dev proxy `/api` → `http://localhost:<API_PORT>`.
- In production, frontend uses `VITE_API_BASE_URL`.

## CORS
- Dev: allow `http://localhost:<FRONTEND_PORT>`
- Prod: set `CORS_ORIGINS` to SWA/custom domains.

## Azure Notes
- SWA: Node 20; `output_location: dist`; modify generated workflow.
- Web Apps: Linux recommended; Node 20; use Service Principal; set app settings before deploy.

## Checklists
- Preflight: see docs/PREFLIGHT-CHECKLIST.md
- Release: see docs/deployment/RELEASE_CHECKLIST.md
- Deployment: see docs/deployment/DEPLOYMENT.md
