# GitHub Copilot Instructions for Template Projects

## Working Principles
- Be concise and accurate; ask when requirements are ambiguous.
- Never invent facts or URLs; validate any link you provide.
- Follow user direction immediately when they point to a file or concern.
- Do not hard-delete user data without explicit approval.
- Confirm before any production deployment.

## Server & Tasks
- Use provided scripts/tasks for server management; avoid background terminals that could kill processes.
- Prefer `server-manager`-style scripts when present (status/start/stop/restart/logs).
- After significant changes, check status and restart if needed.

## Scaffolding & Tooling
- Avoid interactive scaffolding (create files directly instead of `npx create-*`).
- Keep API base URLs centralized in config; do not hardcode `/api`.
- For Vite projects, ensure Node 20 and `dist` output in workflows.
- Use env files for secrets/config; document new env vars.

## CSS Changes (Protocol)
- If asked to fix CSS, trace the cascade before proposing fixes: structure, selectors, globals, defaults, conflicts, sizing/centering.
- Present one complete fix with rationale; avoid incremental guessing.

## Azure & CI/CD (if present)
- For Azure Static Web Apps: use Node 20, `output_location: dist`; prefer modifying generated workflows.
- For Azure Web Apps: deploy via Service Principal (`AZURE_CREDENTIALS`), use `config-zip`, set app settings (Node 20) before deploy.
- Verify existing workflows/secrets before adding new ones.

## Documentation
- Update session notes when committing, pushing, or deploying.
- Keep README and deployment docs aligned with actual commands and outputs.

## When to Pause and Ask
- Ambiguous requirements
- Destructive actions (delete/overwrite)
- Production deployments
- Major architecture decisions
