## Metadata
- Repository: {{REPOSITORY}}
- System: {{SYSTEM_NAME}}
- Package Version: {{VERSION}}
- Last Reviewed: {{DATE}}
- Status: Draft
- Source of Truth: Yes — for analysis method, priorities, evidence labels, hotspots, anti-patterns, and output format
- Depends On: `manifest.json`, `docs/governance/KNOWN_RISKS.md`, `docs/reference/CODEBASE_GLOSSARY.md`
- Used By: `docs/MASTER_PROMPT.md`, `docs/AUTO_AUDIT_PROMPT.md`
- Owner: {{OWNER}}
- Update Triggers: analysis method change, new hotspot identified, evidence model change, new module added

---

## Purpose and scope

This file governs *how* to analyze this repository. It does not own domain rules, permission rules, or risk entries.

**This file owns:** Analysis role, evidence labels, analysis priorities, hotspots, anti-patterns, hard rules, fix strategy, output format, severity reference.

**This file does not own:** Business rules (`core/DOMAIN_RULES.md`), permission precedence (`core/PERMISSION_MODEL.md`), architecture (`core/ARCHITECTURE.md`), open risks (`governance/KNOWN_RISKS.md`).

**See also:**
- `docs/SYSTEM_OVERVIEW.md` — full system description; read before any analysis session
- `docs/core/DOMAIN_RULES.md` — intended behavior; ground truth for evaluating findings
- `docs/core/ARCHITECTURE.md` — system layers; use to understand blast radius
- `docs/core/PERMISSION_MODEL.md` — permission precedence and conflict rules
- `docs/core/WORKFLOW_MAPS.md` — workflow step maps; map every finding to a step
- `docs/governance/KNOWN_RISKS.md` — pre-identified risks; cross-reference all findings

---

## Analysis role

You are a senior engineer performing a structured security and correctness review. You are not a linter. You are looking for:
- Authorization gaps
- Data integrity risks
- Logic errors in multi-step workflows
- Backend enforcement gaps (frontend-only controls)
- Violations of documented domain rules

---

## Evidence labels

Use these labels on every factual claim:

| Label | Meaning |
|-------|---------|
| `VERIFIED` | Confirmed in source code, migrations, or RLS policies |
| `OBSERVED` | Seen in code but not confirmed as enforced |
| `INFERRED` | Reasonable conclusion from patterns; not directly confirmed |
| `UNKNOWN` | Cannot determine without more context |

---

## Analysis priorities

Work through these in order. Do not skip to lower priorities if higher-priority issues remain unanalyzed.

1. **Authentication and session integrity** — Is auth correctly enforced at every entry point?
2. **Authorization gaps** — Can users access or modify data they should not?
3. **Backend enforcement** — Is business logic enforced server-side, or only in the frontend?
4. **Multi-step workflow integrity** — Can workflows reach invalid states?
5. **Data integrity** — Are there missing constraints, invalid transitions, or race conditions?
6. **Maintainability** — Only flag in full analysis, not PR reviews

---

## Hotspots

*List the files, modules, or patterns in this codebase that are highest risk and require extra scrutiny.*

*Example format:*
- `src/hooks/useAuth.ts` — authentication chain; any change here has wide blast radius
- `supabase/migrations/` — RLS policies; verify every new policy against PERMISSION_MODEL

---

## Anti-patterns

*List known bad patterns specific to this codebase that AI should flag.*

*Example:*
- Frontend-only access checks without server-side enforcement
- Status transitions without server-side state machine validation

---

## Hard rules

*Rules that must never be violated in recommendations.*

- Do not recommend changes that bypass documented permission precedence
- Do not suggest frontend-only fixes for authorization issues
- Prefer the smallest safe fix over structural rewrites (see `governance/REFACTOR_RULES.md`)
- Cross-reference every finding against `governance/KNOWN_RISKS.md` before reporting

---

## Severity reference

| Level | Meaning |
|-------|---------|
| `Critical` | Exploitable now; immediate action required |
| `High` | Significant risk; fix before next release |
| `Medium` | Real risk; fix in current cycle |
| `Low` | Minor issue; fix when convenient |
| `Observation` | No immediate risk; worth noting |

---

## Required output format

Every finding must include:

### Issue
One-sentence summary.

### Type
`Verified issue` | `Conditional risk` | `Observation`

### Evidence
What you found and where. Label every claim (VERIFIED / OBSERVED / INFERRED / UNKNOWN).

### Workflow step
Which step in `core/WORKFLOW_MAPS.md` this affects.

### Known risk
Is this in `governance/KNOWN_RISKS.md`? If yes, reference it. If no, state explicitly.

### Recommendation
Concrete fix. Reference `governance/CHANGE_SAFETY_RULES.md` if the fix is non-trivial.
