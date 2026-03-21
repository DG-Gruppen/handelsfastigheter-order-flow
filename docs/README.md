# AI Analysis Documentation (v2.3)

## Repository
DG-Gruppen/handelsfastigheter-order-flow

## Verified Repository Snapshot
- Default branch: `main`
- Public GitHub repository
- Top-level paths observed: `.lovable`, `docs`, `public`, `src`, `supabase`
- Root files observed: `README.md`, `package.json`, Vite/Tailwind/TS configs, lockfiles, `.env`

## Purpose
This package provides a compact, repo-specific framework for AI-assisted analysis of `handelsfastigheter-order-flow`.

## Read Order
1. `MASTER_PROMPT.md`
2. `core/AI_ANALYSIS.md`
3. `core/DOMAIN_RULES.md`
4. `core/PERMISSION_MODEL.md`
5. `core/ARCHITECTURE.md`
6. `core/WORKFLOW_MAPS.md`
7. `governance/KNOWN_RISKS.md`
8. `governance/CHANGE_SAFETY_RULES.md`
9. `governance/REFACTOR_RULES.md`
10. `reference/CODEBASE_GLOSSARY.md`
11. `AUTO_AUDIT_PROMPT.md`

## Coupled Update Rules
When code changes in these areas, review the matching docs:
- `src/hooks/**`, `src/components/ProtectedRoute*`, auth/admin hooks → `core/PERMISSION_MODEL.md`, `governance/KNOWN_RISKS.md`
- `src/pages/NewOrder*`, `src/pages/OrderDetail*`, approval/order pages → `core/DOMAIN_RULES.md`, `core/WORKFLOW_MAPS.md`
- `src/integrations/**`, `supabase/functions/**`, `supabase/migrations/**` → `core/ARCHITECTURE.md`, `governance/KNOWN_RISKS.md`
- route/layout/app-shell changes in `src/App.tsx`, `src/main.tsx`, nav hooks → `core/ARCHITECTURE.md`, `core/PERMISSION_MODEL.md`

## Notes
The repository already contains `docs/AI_ANALYSIS.md`, `docs/ARCHITECTURE.md`, and `docs/DOMAIN_RULES.md`. This v2.3 layout extends that structure into a more complete, less repetitive, metadata-driven package.
