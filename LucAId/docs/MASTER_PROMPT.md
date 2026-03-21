## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.7.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: No — prompt instructions only; manifest.json owns load order and file roles
- Depends On: `manifest.json`, `docs/core/AI_ANALYSIS.md`, `docs/governance/CHANGE_SAFETY_RULES.md`
- Used By: Claude Code, Cursor, CI manual reviews
- Owner: DG Gruppen
- Update Triggers: load order change, output format change, new control plane rules

---

You are analyzing **SHF Intra** — repository `DG-Gruppen/handelsfastigheter-order-flow`.

This is a full repository analysis. Load the files below in order before beginning. If any file is missing, state that explicitly and continue with reduced confidence.

The canonical file list is defined in `manifest.json` → `verified_context`. The order below matches that list. If this prompt and `manifest.json` diverge, `manifest.json` wins.

---

## Load order

1. `docs/SYSTEM_OVERVIEW.md` — full system description; read first to orient
2. `docs/core/AI_ANALYSIS.md` — analysis method, priorities, output format
3. `docs/core/ARCHITECTURE.md` — layers, data flows, trust boundaries, enforcement ownership
4. `docs/core/DOMAIN_RULES.md` — authoritative business rules for all modules
5. `docs/core/PERMISSION_MODEL.md` — permission sources, precedence, conflict rules
6. `docs/core/WORKFLOW_MAPS.md` — step-by-step workflow maps with failure points
7. `docs/governance/CHANGE_SAFETY_RULES.md` — how to propose changes safely
8. `docs/governance/DOC_OWNERSHIP_RULES.md` — which file owns which facts
9. `docs/governance/KNOWN_RISKS.md` — risk register; cross-reference all findings here
10. `docs/governance/REFACTOR_RULES.md` — when and how to recommend structural changes
11. `docs/reference/DATA_MODEL.md` — DB table definitions, enums, constraints
12. `docs/reference/CODEBASE_GLOSSARY.md` — canonical term definitions

Do not load `AUTO_AUDIT_PROMPT.md` during full analysis — it is for PR-scoped review only.

---

## Core constraints

- Do not assume backend enforcement unless verified in backend source, migrations, or access-control policies.
- Frontend visibility, route guards, and disabled controls do not prove authorization.
- Prefer the smallest safe fix over structural rewrites.
- Use evidence labels (VERIFIED / OBSERVED / INFERRED / UNKNOWN) on every factual claim.
- Use `reference/CODEBASE_GLOSSARY.md` definitions before inferring meaning from code.
- Cross-reference every finding against `governance/KNOWN_RISKS.md`.
- When a rule appears in multiple files, `core/DOMAIN_RULES.md` is the source of truth.

---

## Required output format

Every finding must include:

### Issue
One-sentence summary.

### Type
`Verified issue` | `Conditional risk` | `Observation`

### Evidence
What you found and where. Label every claim: VERIFIED / OBSERVED / INFERRED / UNKNOWN.

### Workflow step
Which step in `core/WORKFLOW_MAPS.md` this affects. If none, state explicitly.

### Known risk
Is this in `governance/KNOWN_RISKS.md`? Reference it if yes. State "Not previously registered" if no.

### Recommendation
Concrete fix. Must comply with `governance/CHANGE_SAFETY_RULES.md`.
