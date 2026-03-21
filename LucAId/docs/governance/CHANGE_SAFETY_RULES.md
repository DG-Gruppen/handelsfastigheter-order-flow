## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.7.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for change safety constraints and escalation rules
- Depends On: `core/DOMAIN_RULES.md` §16, `core/ARCHITECTURE.md`, `governance/KNOWN_RISKS.md`
- Used By: `core/AI_ANALYSIS.md`, `docs/MASTER_PROMPT.md`, `docs/AUTO_AUDIT_PROMPT.md`
- Owner: DG Gruppen
- Update Triggers: new high-risk files identified, escalation model changes, new sensitive subsystem added

---

## Purpose

Defines how Claude Code should propose or make changes safely across all modules of SHF Intra.

---

## Main principle

Prefer the smallest safe change that solves the problem. A targeted local fix is safer than a structural rewrite unless the structure itself is causing the problem.

---

## Safe change rules

- Prefer local guards before structural rewrites.
- Do not change auth, permissions, and order lifecycle together unless explicitly requested.
- Do not merge permission systems during a bugfix.
- Do not treat UI lockout as a complete security fix.
- Preserve current behavior unless it clearly violates `core/DOMAIN_RULES.md`.
- If backend enforcement is unknown, do not assume it exists.
- When changing order or workflow transitions, verify side effects and rollback behavior.
- Prefer isolated changes over cross-cutting refactors.
- When changing a sensitive subsystem (passwords, impersonation, documents), treat all adjacent code as in-scope.

---

## Escalation model

| Level | Condition | Required action |
|---|---|---|
| **SAFE** | Isolated change; no high-risk file; local blast radius | Propose fix with analysis |
| **REVIEW** | Touches a high-risk file or crosses layer boundaries | Add explicit blast-radius analysis before proposing |
| **CRITICAL** | Fix closes a UI gap but underlying risk requires backend enforcement | Propose frontend fix AND state backend hardening required |
| **BLOCKED** | Change requires modifying auth + permissions + lifecycle simultaneously | Flag the coupling; recommend breaking into separate steps |

---

## High-risk files

Any change to these files requires explicit blast-radius analysis:

| File | Why high-risk |
|---|---|
| `src/hooks/useAuth.tsx` | Session and role resolution — affects all access decisions |
| `src/hooks/useModules.tsx` | Module access and Realtime channel — structural permission dependency |
| `src/hooks/useAdminAccess.tsx` | Admin access gating |
| `src/hooks/useModulePermission.tsx` | Per-module permission evaluation |
| `src/pages/NewOrder.tsx` | Approval routing, order creation, multi-step write |
| `src/pages/OrderDetail.tsx` | Lifecycle transitions, approval/reject/deliver authority |
| `src/pages/Admin.tsx` | Admin visibility and action boundaries |
| `src/pages/Passwords.tsx` + `src/lib/passwordCrypto.ts` | Encrypted password vault |
| `src/pages/Documents.tsx` + `src/hooks/useDocuments.tsx` | Folder-level access control |
| `supabase/functions/impersonate-user/**` | Real session token generation |
| `supabase/functions/get-passwords-key/**` | AES key issuance |
| `supabase/functions/process-email-queue/**` | Email queue and DLQ logic |
| `supabase/functions/ai-chat/**` | AI assistant and content index access |

---

## Sensitive subsystem rules

### Password vault
- Never change key issuance logic without reviewing all callers of `get-passwords-key`
- Never change `shared_password_groups` RLS without verifying the full access model
- `password_access_log` writes must always be preserved

### Impersonation
- Never relax the IT role check in `impersonate-user` without explicit approval
- `ImpersonationBanner` must always be visible during impersonated sessions — do not touch dismissal logic

### Document access
- Never change `has_folder_access()` or `has_folder_write_access()` DB functions without end-to-end testing of the folder hierarchy
- Never change storage bucket policies without verifying they still match folder access_roles

### Email queue
- Never bypass DLQ logic — silent failure accumulation is a known risk
- Never change retry count or TTL without understanding downstream impact on `email_send_state`

---

## Before proposing any change

1. **Blast radius** — what other areas does this change touch?
2. **Regression risk** — what currently working behavior could break?
3. **Backend dependency** — does the fix rely on backend enforcement that may not exist?
4. **Smaller alternative** — is there a more targeted fix?

---

## What Claude must not assume

- That a large refactor is safer than a small local fix
- That duplication always justifies structural change
- That UI cleanup is worth risking core workflows
- That a fix that closes a UI gap has also closed the backend gap
- That the password vault, impersonation, or document access modules are safe to change without reviewing the full access chain

---

## Output format for change proposals

- **What is changing** — specific function, query, or behavior
- **Why it is safe** — blast radius analysis, no regression risk
- **What could break** — honest assessment of adjacent risk
- **How to test it** — specific scenario or check
- **Backend hardening needed** — if yes, state explicitly what and why the frontend fix alone is insufficient
