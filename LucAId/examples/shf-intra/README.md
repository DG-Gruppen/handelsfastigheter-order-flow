# Example: SHF Intra (DG-Gruppen/handelsfastigheter-order-flow)

This directory contains a fully populated LucAId package for **SHF Intra** — the internal intranet and operations platform for Svenska Handelsfastigheter (SHF).

It serves as a reference implementation showing what a complete LucAId project layer looks like.

## System
- **Repository:** DG-Gruppen/handelsfastigheter-order-flow
- **Stack:** React 18 + TypeScript + Vite + Supabase (Auth, DB, Edge Functions, Realtime) + TanStack Query + Tailwind + shadcn/ui
- **LucAId version this example was built against:** 3.4.0

## Contents

| File | Description |
|------|-------------|
| `docs/SYSTEM_OVERVIEW.md` | Full system description: 17 modules, 40+ tables, roles, integrations |
| `docs/core/AI_ANALYSIS.md` | Analysis priorities, hotspots, anti-patterns for this codebase |
| `docs/core/ARCHITECTURE.md` | React SPA + Supabase architecture, trust boundaries, enforcement ownership |
| `docs/core/DOMAIN_RULES.md` | Business rules for all 17 modules |
| `docs/core/PERMISSION_MODEL.md` | Permission resolution: user_roles → groups → module_permissions |
| `docs/core/WORKFLOW_MAPS.md` | 14 workflows with smoke tests |
| `docs/governance/KNOWN_RISKS.md` | Risk register covering all identified risks |
| `docs/reference/DATA_MODEL.md` | Full DB schema with enums, constraints, and risk annotations |
| `docs/reference/CODEBASE_GLOSSARY.md` | Canonical definitions for all system-specific terms |

## How to use this example

To adapt this for a new Lovable/Supabase project:

1. Copy the `docs/` skeleton from the LucAId root (not this folder)
2. Generate a new `SYSTEM_OVERVIEW.md` for your project (see instructions in the skeleton)
3. Use this example as a reference for level of detail expected in each file
4. Fill in your `manifest.json` impact_map with your project's file structure

## Notes

- This example was built for a React + Supabase stack. If your stack differs, adapt `ARCHITECTURE.md` and `PERMISSION_MODEL.md` accordingly.
- The `impact_map` patterns in the example manifest (`manifest.json.example` in this folder) use `src/pages/`, `supabase/functions/` etc. — update for your project's structure.
