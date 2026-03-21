## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.7.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for analysis method, priorities, evidence labels, hotspots, anti-patterns, and output format
- Depends On: `manifest.json`, `docs/governance/KNOWN_RISKS.md`, `docs/reference/CODEBASE_GLOSSARY.md`
- Used By: `docs/MASTER_PROMPT.md`, `docs/AUTO_AUDIT_PROMPT.md`
- Owner: DG Gruppen
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

These files and modules are highest risk and require extra scrutiny:

- `src/hooks/useAuth.tsx` — Session and role resolution chain; any change affects all access decisions across all modules
- `src/hooks/useModules.tsx` — Module access resolution and Realtime subscription; structural dependency for sidebar and route guards
- `src/hooks/useAdminAccess.tsx` — Admin panel access gating; slug mapping could drift from `useModules`
- `src/hooks/useModulePermission.tsx` — Per-module permission evaluation; used by all feature-gated pages
- `src/pages/NewOrder.tsx` — Order creation with approval routing, auto-approval logic, and email dispatch
- `src/pages/OrderDetail.tsx` — Lifecycle transitions (approve/reject/deliver) with authorization checks
- `src/pages/Onboarding.tsx` — Creates placeholder profiles; auto-approval for certain roles; links via `handle_new_user()` trigger
- `src/pages/Passwords.tsx` + `src/lib/passwordCrypto.ts` — AES-encrypted vault; key issuance via Edge Function
- `src/pages/Documents.tsx` + `src/hooks/useDocuments.tsx` — Folder-level RBAC with `access_roles`/`write_roles`
- `supabase/functions/impersonate-user/` — Generates real session tokens; IT/admin role check is the only gate
- `supabase/functions/get-passwords-key/` — Returns AES encryption key; JWT-only gate, no group check
- `supabase/functions/process-email-queue/` — pgmq queue processing with DLQ; rate limiting via `email_send_state`
- `supabase/functions/ai-chat/` — AI assistant accessing `content_index`; prompt injection surface
- `supabase/migrations/` — RLS policies; verify every new policy against PERMISSION_MODEL

---

## Anti-patterns

Flag these patterns when found in this codebase:

- **Frontend-only access checks without server-side enforcement** — e.g. hiding a button without RLS policy
- **Status transitions without server-side state machine validation** — orders can be set to any status via UPDATE
- **Client-side role checks used as security controls** — `useAuth` role checks are UI convenience, not authorization
- **Direct Supabase UPDATE without column-level restrictions** — approver can change any column on `orders`
- **AES key issuance without group membership check** — `get-passwords-key` returns key to all authenticated users
- **String-based department matching** — `profiles.department` is text, not FK to `departments.id`
- **Trigger-based indexing without failure handling** — content_index triggers silently fail
- **Storage bucket policies misaligned with folder-level access_roles** — URL bypass risk

---

## Hard rules

- Do not recommend changes that bypass documented permission precedence (`core/PERMISSION_MODEL.md`)
- Do not suggest frontend-only fixes for authorization issues
- Prefer the smallest safe fix over structural rewrites (see `governance/REFACTOR_RULES.md`)
- Cross-reference every finding against `governance/KNOWN_RISKS.md` before reporting
- Do not assume backend enforcement exists unless verified in migrations, RLS policies, or Edge Function source

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
