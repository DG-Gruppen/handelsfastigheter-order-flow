## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.4.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for all open and resolved risk entries
- Depends On: `core/DOMAIN_RULES.md`, `core/ARCHITECTURE.md`, `core/PERMISSION_MODEL.md`, `core/WORKFLOW_MAPS.md`
- Used By: `core/AI_ANALYSIS.md`, `governance/CHANGE_SAFETY_RULES.md`, `docs/MASTER_PROMPT.md`, `docs/AUTO_AUDIT_PROMPT.md`
- Owner: DG Gruppen
- Update Triggers: new risks identified, backend guarantees implemented, risk status changes, PR review findings

---

## Purpose

Lists known and likely risk areas across the full SHF Intra platform. Used as a caution layer during analysis and PR review.

This file owns risk entries — description, status, severity, resolution path. Underlying rules are owned by `core/DOMAIN_RULES.md`. Do not redefine rules here — reference by section.

---

## Status definitions

- **Open** — active; no backend mitigation confirmed
- **Partial** — reduced but not fully resolved (e.g. frontend guard added, RLS not yet in place)
- **Resolved** — confirmed mitigated server-side

When resolved: do not delete. Update Status, add `Resolved By` and `Resolution Date`, add `CHANGELOG.md` entry. Also update `core/DOMAIN_RULES.md` §17 and `core/ARCHITECTURE.md` risk pointer table.

### Resolved entry format
```
- **Status:** Resolved
- **Resolution Date:** YYYY-MM-DD
- **Resolved By:** supabase/migrations/YYYYMMDD_description.sql
- **Resolution Summary:** One sentence.
```

---

## Finding type definitions

- **Verified issue** — confirmed in inspected code
- **Conditional risk** — plausible if backend enforcement is missing (not yet verified)
- **Design gap** — structural weakness creating risk even without a confirmed exploit

---

## Risk register — Open

---

### Risk: Frontend approval routing

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** Critical
- **Workflow:** Workflow 3, Steps 5–6
- **Domain rule:** `core/DOMAIN_RULES.md` §4, §17
- **Description:** `resolveApprovalRouting(...)` runs entirely in the browser. The computed `approver_id` and auto-approve flag are submitted as part of the order payload. The backend does not independently verify the routing result. A manipulated client can forge `approver_id`, force auto-approval, or route to an unintended approver.
- **Resolution path:** Move approval routing to an RPC function. Verify `approver_id` server-side before order insert.

---

### Risk: Impersonation server-side role check unverified

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** Critical
- **Workflow:** Workflow 9, Step 4
- **Domain rule:** `core/DOMAIN_RULES.md` §14, §16 Invariant 9
- **Description:** `impersonate-user` edge function is intended to verify IT role server-side before issuing session tokens. This check has not been confirmed in inspected code. If absent or bypassable, any authenticated user could impersonate any other user, gaining their full session permissions.
- **Resolution path:** Verify and harden the server-side role check in `impersonate-user/index.ts`. Add audit logging for impersonation events. Add self-impersonation guard.

---

### Risk: Admin UI gating only

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** High
- **Workflow:** Workflow 10, Steps 2–6
- **Domain rule:** `core/DOMAIN_RULES.md` §17
- **Description:** Admin sections are hidden via `useAdminAccess` in the UI. If RLS does not restrict writes to admin-role users, admin actions are accessible via direct API calls.
- **Resolution path:** Add RLS policies restricting sensitive table writes to verified admin role per table.

---

### Risk: Domain restriction client-side only

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** High
- **Workflow:** Workflow 1, Step 2
- **Domain rule:** `core/DOMAIN_RULES.md` §17
- **Description:** The `hd: "handelsfastigheter.se"` domain restriction is applied in `Login.tsx` as an OAuth hint. Server-side enforcement not confirmed. A user with a non-SHF Google account could potentially authenticate if they bypass the client-side hint.
- **Resolution path:** Enforce domain restriction in an auth hook or Edge Function at the Supabase level.

---

### Risk: Multi-step order write without transaction

- **Status:** Open
- **Type:** Data integrity risk
- **Severity:** High
- **Workflow:** Workflow 3, Steps 7–8
- **Domain rule:** `core/DOMAIN_RULES.md` §5, §16 Invariant 1
- **Description:** `orders` and `order_items` are inserted in two sequential client-side calls with no transaction. A failure between them produces an orphaned `orders` row with no items — an invalid state per Invariant 1.
- **Resolution path:** Wrap both inserts in a single RPC call.

---

### Risk: Approver ID not verified server-side

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** High
- **Workflow:** Workflow 4, Step 2; Workflow 5, Step 2
- **Domain rule:** `core/DOMAIN_RULES.md` §6, §16 Invariant 4
- **Description:** Approve and reject actions update the order row without backend verification that `auth.uid()` matches `approver_id`. Any authenticated user who reaches the endpoint could potentially approve or reject any order.
- **Resolution path:** Add RLS policy: `auth.uid() = approver_id` required for approve/reject updates. Also enforce `WHERE status = 'pending'`.

---

### Risk: Recipient privilege not server-enforced

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** High
- **Workflow:** Workflow 3, Step 4
- **Domain rule:** `core/DOMAIN_RULES.md` §5
- **Description:** The `isPrivileged` check for `recipient_type: "existing"` lives only in `NewOrder.tsx`. A manipulated client can submit an order on behalf of another user without the required privilege.
- **Resolution path:** Verify `isPrivileged` server-side in the order insert RPC or via RLS.

---

### Risk: Password AES key returned to all authenticated users

- **Status:** Open
- **Type:** Design gap
- **Severity:** High
- **Workflow:** Workflow 8, Step 2
- **Domain rule:** `core/DOMAIN_RULES.md` §11, §16 Invariant 8
- **Description:** `get-passwords-key` edge function returns the AES encryption key to any authenticated user regardless of group membership. Access control for passwords relies entirely on `shared_password_groups` RLS. If RLS has any gap, an authenticated user could retrieve encrypted password values and decrypt them with the key.
- **Resolution path:** Add group membership check in `get-passwords-key` — only return key if user belongs to at least one group with password access. Alternatively, consider per-password or per-group encryption keys.

---

### Risk: Document storage bucket URL bypass

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** High
- **Workflow:** Workflow 7, Step 6b
- **Domain rule:** `core/DOMAIN_RULES.md` §10, §16 Invariant 10
- **Description:** Document files stored in the `documents` Supabase Storage bucket may be accessible via direct storage URL even if the corresponding `document_folders` row restricts access via `access_roles`. If storage bucket RLS policies do not mirror folder-level access control, restricted files are reachable by URL.
- **Resolution path:** Verify storage bucket RLS policies tie file access to `has_folder_access()` or equivalent. Use signed URLs with expiry for file downloads rather than public bucket access.

---

### Risk: Weak lifecycle enforcement on order state transitions

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** High
- **Workflow:** Workflows 4, 5, 6 — status update steps
- **Domain rule:** `core/DOMAIN_RULES.md` §3, §16 Invariant 3
- **Description:** Approve, reject, and deliver status updates may be scoped only to order `id` without checking current status is the expected predecessor. This allows invalid transitions (e.g. `pending → delivered`) if backend does not enforce the lifecycle.
- **Resolution path:** Add status predicate to update queries. Enforce lifecycle transitions via RLS or RPC.

---

### Risk: Email side effects without error handling

- **Status:** Open
- **Type:** Data/workflow integrity risk
- **Severity:** High
- **Workflow:** Workflow 13
- **Domain rule:** `core/DOMAIN_RULES.md` §8, §16 Invariant 11
- **Description:** `supabase.functions.invoke("send-email")` called directly from components without error handling or retry. A network failure produces a silently incomplete order action.
- **Resolution path:** Wrap all direct email invocations in try/catch. Surface failure to user. Consider routing all transactional email through pgmq for retry safety.

---

### Risk: `org_chart_settings` read pre-auth

- **Status:** Open
- **Type:** Design gap
- **Severity:** Medium
- **Workflow:** Workflow 1, Step 3; Workflow 2, Step 3
- **Domain rule:** `core/DOMAIN_RULES.md` §17
- **Description:** `useNavSettings.tsx` reads `org_chart_settings` (a key-value config table) on the login page before authentication. This exposes internal configuration — IT remote help URLs, theme defaults, nav toggles — to unauthenticated contexts.
- **Resolution path:** Defer `org_chart_settings` reads until after authentication, except for values explicitly needed pre-auth (e.g. login page branding). Split public vs. internal settings.

---

### Risk: Role merge precedence unverified

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** Medium
- **Workflow:** Workflow 1, Step 7; Workflow 2, Step 4
- **Domain rule:** `core/DOMAIN_RULES.md` §2; `core/PERMISSION_MODEL.md` — Role merge behavior
- **Description:** Direct and group-derived roles merged via `new Set()` in `useAuth.tsx`. Consuming code must apply direct-role precedence explicitly. If it does not, a group-derived role could shadow a direct role in some code paths.
- **Resolution path:** Verify consuming code applies direct-role priority. If not, add explicit priority resolution after merge.

---

### Risk: Realtime channel silent failure

- **Status:** Open
- **Type:** Design gap
- **Severity:** Medium
- **Workflow:** Workflow 2, Step 2
- **Domain rule:** `core/ARCHITECTURE.md` Layer 2
- **Description:** `useModules.tsx` depends on a Realtime channel for `module_permissions`. If the channel drops silently, the UI operates on stale permission state with no user indication.
- **Resolution path:** Add channel health check or reconnect strategy with fallback reload.

---

### Risk: AI assistant surfaces access-restricted content

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** Medium
- **Workflow:** Workflow 12, Query steps 2–3
- **Domain rule:** `core/DOMAIN_RULES.md` §15
- **Description:** `content_index` may contain unpublished KB articles, draft news, or access-restricted documents. The `ai-chat` edge function queries `content_index` without confirmed per-user access filtering. Any authenticated user may retrieve restricted content via AI chat.
- **Resolution path:** Add `is_published` and access role filters to `content_index` indexing logic. Add per-user access check in `ai-chat` before including content as context.

---

### Risk: Email DLQ silent accumulation

- **Status:** Open
- **Type:** Design gap
- **Severity:** Medium
- **Workflow:** Workflow 11, Step 9
- **Domain rule:** `core/DOMAIN_RULES.md` §13
- **Description:** When emails fail after max retries, they are moved to a dead-letter queue. There is no confirmed alerting mechanism for DLQ accumulation. Failed emails (auth emails, notifications) may go unnoticed indefinitely.
- **Resolution path:** Add DLQ size monitoring and alerting. Consider admin panel visibility into DLQ contents.

---

### Risk: Content index dual-path divergence

- **Status:** Open
- **Type:** Design gap
- **Severity:** Medium
- **Workflow:** Workflow 12, Indexing steps 1–4
- **Domain rule:** `core/DOMAIN_RULES.md` §15
- **Description:** `content_index` is updated via both real-time DB triggers and batch sync jobs. If these paths produce different results (e.g. trigger fires but batch sync overwrites with stale data), the AI assistant answers from an inconsistent index.
- **Resolution path:** Define clear ownership of indexing paths per content type. Ensure batch sync does not overwrite trigger-updated entries with older data. Add index consistency check.

---

### Risk: Cision deduplication by URL

- **Status:** Open
- **Type:** Design gap
- **Severity:** Low
- **Workflow:** Workflow 12, Indexing step 4
- **Domain rule:** `core/DOMAIN_RULES.md` §15
- **Description:** `fetch-cision-feed` deduplicates press releases using `source_url` matching. If Cision changes URL structure for existing releases, duplicates will be created in the `news` table.
- **Resolution path:** Add a secondary deduplication key (e.g. Cision release ID from XML) in addition to URL.

---

### Risk: RLS on orders table without column restrictions

- **Status:** Open
- **Type:** Conditional security risk
- **Severity:** Medium
- **Workflow:** Workflow 4, Step 3; Workflow 5, Step 3
- **Domain rule:** `core/DOMAIN_RULES.md` §6
- **Description:** *(inferred — verify against source)* The RLS policy allowing `UPDATE` by approver may not restrict which columns can be updated. An approver could theoretically modify fields beyond `status` (e.g. `approver_id`, `requester_id`, order details).
- **Resolution path:** Restrict UPDATE RLS to only the columns the approver should be able to modify (`status`). Use an RPC function for approve/reject to control the exact mutation.

---

### Risk: Documentation drift

- **Status:** Open
- **Type:** Governance risk
- **Severity:** Low
- **Description:** This docs package and `docs/SYSTEM_OVERVIEW.md` may diverge over time if code changes are not reflected in both. The GitHub Action flags affected docs on PRs but does not prevent drift.
- **Resolution path:** Apply coupled update rules in `docs/README.md`. Maintain Lovable standing instruction (Prompt 2) to keep `SYSTEM_OVERVIEW.md` current.

---

## Risk register — Resolved

No risks have been resolved as of v3.2. When a risk is resolved, move its entry here following the format above.
