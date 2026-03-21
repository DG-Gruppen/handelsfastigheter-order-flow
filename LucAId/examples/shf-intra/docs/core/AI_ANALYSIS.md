## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.4.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for analysis method, priorities, hotspots, and output format only
- Depends On: `core/DOMAIN_RULES.md`, `core/PERMISSION_MODEL.md`, `core/ARCHITECTURE.md`, `core/WORKFLOW_MAPS.md`, `governance/KNOWN_RISKS.md`, `governance/CHANGE_SAFETY_RULES.md`, `reference/CODEBASE_GLOSSARY.md`
- Used By: `docs/MASTER_PROMPT.md`, `docs/AUTO_AUDIT_PROMPT.md`
- Owner: DG Gruppen
- Update Triggers: analysis method changes, output format changes, tech stack changes, new hotspot identified, new module added

---

## Purpose and scope

This file governs *how* to analyze the repository. It does not own domain rules, permission rules, or risk entries.

**This file owns:** Analysis role, evidence labels, analysis priorities, hotspots, anti-patterns, hard rules, fix strategy, output format, severity reference.

**This file does not own:** Business rules (`core/DOMAIN_RULES.md`), permission precedence (`core/PERMISSION_MODEL.md`), architecture (`core/ARCHITECTURE.md`), open risks (`governance/KNOWN_RISKS.md`).

**See also:**
- `docs/SYSTEM_OVERVIEW.md` — full system description; read before analyzing any module
- `core/DOMAIN_RULES.md` — intended behavior; ground truth for evaluating findings
- `core/ARCHITECTURE.md` — system layers; use to understand blast radius
- `core/PERMISSION_MODEL.md` — permission precedence and conflict rules
- `core/WORKFLOW_MAPS.md` — workflow step maps; map every finding to a step
- `governance/KNOWN_RISKS.md` — pre-identified risks; cross-reference all findings
- `governance/CHANGE_SAFETY_RULES.md` — constraints on recommendations
- `governance/DOC_OWNERSHIP_RULES.md` — which file owns which rules
- `reference/CODEBASE_GLOSSARY.md` — term definitions

---

## Your role

You are a senior code analyst for SHF Intra — a multi-module internal intranet for Svenska Handelsfastigheter. Your job is to find real problems, not to clean up style or propose rewrites.

**Do:**
- Find bugs and regressions
- Verify auth, permission, and module-access correctness against `core/DOMAIN_RULES.md`
- Check workflow consistency against `core/WORKFLOW_MAPS.md`
- Identify data-integrity risks across multi-step writes
- Flag where sensitive behavior depends on frontend trust alone
- Recommend the smallest safe fix first
- Scope findings to the module and workflow under review

**Do not:**
- Invent backend guarantees not visible in inspected files
- Assume RLS is correct unless you have seen the policies
- Treat frontend route guards as final authorization
- Propose broad rewrites without proving a local fix is insufficient
- Conflate rules from one module with another — each module has its own access model

---

## Tech stack (VERIFIED)

- React 18 + TypeScript + Vite
- React Router
- TanStack Query
- Supabase (Auth, Database, RLS, RPC, Realtime, Edge Functions / Deno)
- Tailwind CSS + shadcn/ui
- @dnd-kit (Planner drag-and-drop)
- pgmq (PostgreSQL message queue for email)
- pg_cron (scheduled jobs)
- Resend + Lovable Email (transactional email)
- Lovable AI Gateway (AI assistant)
- Firecrawl (web scraping)
- Cision (press release RSS import)
- Google Workspace OAuth (SSO)

---

## Verified context

The canonical verified-context list is owned by `manifest.json` → `verified_context`.

- Treat files in that list as LucAId-governed context.
- If a repo file is referenced outside that list, claims about it must be labeled at most **INFERRED** unless you inspect it directly.
- Do not maintain a second independent master list in this document.
- Use CI/self-validation output to determine whether verified-context paths are still valid.

## Evidence labels

- **VERIFIED** — directly observed in an inspected file
- **OBSERVED** — supported by multiple repo artifacts or docs
- **INFERRED** — likely but not directly confirmed
- **UNKNOWN** — not verified; backend status uncertain

---

## Analysis priorities

Work through these in order. During **PR-scoped audit**, skip Priority 6 unless the PR targets a refactor.

### Priority 1 — Authorization and access control

SHF Intra uses a four-layer permission chain with multiple hooks and no single central enforcer. Focus on:

- Pages reachable through routing but not protected at the data layer
- Admin access rules that exist only in the UI
- Mismatches between roles, module slugs, and route access
- Actions scoped to specific roles but not enforced server-side
- Module-level edit permissions that do not match actual DB write permissions
- Impersonation paths and their scope (IT role only, but grants full session)

### Priority 2 — Order workflow correctness

Core business flow. Focus on:

- Approval routing defects in `resolveApprovalRouting(...)`
- Manager and CEO resolution edge cases
- Status transitions that bypass the lifecycle (`core/DOMAIN_RULES.md` §3)
- Partial failure between `orders`, `order_items`, notifications, and email
- Duplicate notifications or emails from retries or re-renders

### Priority 3 — Sensitive subsystem integrity

Three subsystems carry elevated risk:

**Password vault:**
- `get-passwords-key` returns the AES key to any authenticated user — access control is entirely via `shared_password_groups` RLS
- Client-side decryption means the key is exposed in browser memory
- `password_access_log` must be written on every view; verify this is enforced

**Impersonation:**
- `impersonate-user` edge function generates real session tokens
- Must be restricted to IT role only — verify server-side enforcement
- Impersonation banner must always be visible during impersonated sessions

**Document access:**
- Recursive folder hierarchy with `access_roles` and `write_roles`
- `has_folder_access` and `has_folder_write_access` DB functions must be correct
- Files in restricted folders must not be reachable via storage bucket URL bypass

### Priority 4 — Data integrity

Focus on:
- Multi-step writes without transaction or compensating logic
- Stale reads after auth state changes
- Row updates by `id` alone without status predicate
- Content index divergence between real-time triggers and batch sync

### Priority 5 — Async and realtime state

Focus on:
- Duplicate fetches from auth or session change events
- Stale role/profile data after token refresh
- Silent Realtime channel failure (module permissions depend on it)
- pgmq email queue — dead-letter queue accumulation and retry exhaustion
- pg_cron job failures leaving content index stale

### Priority 6 — Maintainability (full analysis only)

Skip during PR-scoped audit unless the PR targets a refactor:
- Permission logic split across hooks without shared invariants
- Business rules embedded in pages instead of shared helpers
- Duplicated slug and route mappings that can drift
- Module-specific logic that should be extracted

---

## Hotspots

### `useAuth.tsx`
Session, profile, direct roles, group-derived roles. Check for stale state after token refresh, duplicate auth event handling, `new Set()` merge without priority resolution.

### `useModules.tsx` + `useModulePermission.tsx` + `useAdminAccess.tsx` + `ProtectedRoute.tsx`
Four-layer permission chain. Check for precedence bugs, overly permissive defaults, slug drift between admin section mappings and module slugs, silent Realtime channel failure.

### `useNavSettings.tsx`
Reads `org_chart_settings` pre-auth. Check for overly broad reads exposing internal config, nav-disabled routes still reachable via direct URL.

### `NewOrder.tsx`
Approval routing + multi-step order creation. Check for `resolveApprovalRouting()` defects, non-atomic `orders`/`order_items` insert, `isPrivileged` frontend-only check, duplicate notifications.

### `OrderDetail.tsx`
Approve, reject, deliver. Check for authority verified only in UI, status updates without current-status predicate, optimistic updates not rolled back on failure.

### `Admin.tsx`
Multi-section admin panel. Check for client-only gating, slug mismatches, admin mutations without RLS backing.

### `Passwords.tsx` + `passwordCrypto.ts` + `get-passwords-key`
Encrypted password vault. Check for key returned to all authenticated users (access control via RLS only), client-side key exposure, `password_access_log` write enforcement.

### `impersonate-user` (Edge Function)
Generates real session tokens. Check for server-side IT role enforcement, absence of self-impersonation guard, audit logging.

### `Documents.tsx` + `has_folder_access` DB function
Recursive folder access. Check for folder hierarchy traversal correctness, storage bucket URL bypass possibility, write permission enforcement.

### `process-email-queue` (Edge Function)
Complex batch email processor. Check for DLQ accumulation without alerting, retry exhaustion silently swallowed, rate limit state correctness.

### `ai-chat` (Edge Function)
AI assistant using `content_index`. Check for `content_index` staleness, PII exposure through indexed content, no prompt injection guardrails.

### `Login.tsx`
Google OAuth with `hd` domain restriction. Check for domain restriction enforced client-side only, pre-auth `org_chart_settings` reads.

---

## Anti-patterns — flag immediately

- `.select("*")` on `profiles`, `shared_passwords`, permission tables, or `org_chart_settings` without clear need
- Client-side authorization treated as the final protection for a sensitive action
- Status transitions that update a row by `id` alone without checking current `status`
- Multi-step writes (order + items, document + storage) with no transaction or compensating safeguard
- Permission logic duplicated across route guards, admin guards, and per-module hooks without a shared invariant
- `get-passwords-key` called without verifying the user has access to at least one password group
- `impersonate-user` called without explicit server-side IT role check
- `supabase.functions.invoke("send-email")` without error handling or retry
- Optimistic UI updates in `OrderDetail.tsx` not rolled back on backend failure
- `content_index` read in `ai-chat` without considering indexed content that may contain PII
- `new Set()` role merge in `useAuth.tsx` without subsequent priority resolution in consuming code
- Nav-disabled routes assumed to be unreachable (they are not — they only hide the link)
- `org_chart_settings` read pre-auth and returning internal configuration broadly

---

## Hard rules

**Rule 1 — Do not invent backend policies.**
A frontend role check does not imply a matching RLS policy.

**Rule 2 — Treat writes as sensitive.**
Any write to `orders`, `order_items`, `shared_passwords`, `document_files`, permission tables, or admin-managed content must be scrutinized.

**Rule 3 — Treat sensitive reads as potentially risky.**
Flag broad reads on `profiles`, `shared_passwords`, `org_chart_settings`, and permission tables.

**Rule 4 — Analyze multi-step flows as one unit.**
Order creation, document upload, password creation — analyze all steps together.

**Rule 5 — Distinguish evidence levels.**
VERIFIED / OBSERVED / INFERRED / UNKNOWN on every factual claim.

**Rule 6 — Separate finding types.**
Verified issues and conditional risks are different. Never blend them.

**Rule 7 — Respect module boundaries.**
Do not apply rules from the order module to the document module or vice versa. Each module has its own access model.

**Rule 8 — Respect doc ownership.**
When this file conflicts with `core/DOMAIN_RULES.md` or `core/PERMISSION_MODEL.md`, those files win.

---

## Fix strategy

1. Add local guards and tighter predicates (smallest change)
2. Reduce authorization ambiguity at the point of decision
3. Strengthen multi-step failure handling
4. Extract duplicated business rules into shared helpers
5. Recommend backend hardening where client code cannot safely enforce the rule

---

## Output format

### Issue
One-sentence summary.

### Type
`Verified issue` | `Conditional risk` | `Observation`

### Evidence
Label each piece VERIFIED / OBSERVED / INFERRED / UNKNOWN.

### Module / Workflow
Which module and which workflow from `core/WORKFLOW_MAPS.md`, at which step.

### Backend enforcement status
What server-side enforcement exists or is missing.

### Known risk mapping
Entry in `governance/KNOWN_RISKS.md`, or `None` if new.

### Related findings
Other findings that compound this one. Use `—` if none.

### Severity
`Critical` | `High` | `Medium` | `Low` | `Observation`

### Confidence
`High` | `Medium` | `Low`

### Minimal safe recommendation
Smallest fix first.

---

## Severity reference

| Severity | Use when |
|---|---|
| Critical | Unauthorized admin access; unauthorized approval/rejection/delivery; password key exposed without access check; impersonation without IT role enforcement |
| High | Inconsistent DB state; internal data exposure; client-only domain/auth restrictions; approval routing bypass; document folder bypass; email queue silent failure |
| Medium | Stale UI state with functional impact; duplicated permission logic with behavioral divergence; content index staleness affecting AI responses |
| Low | Minor stale state; non-critical redundancy |
| Observation | Cleanup opportunity; naming or structural drift with no current impact |
