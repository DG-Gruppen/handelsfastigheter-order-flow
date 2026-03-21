## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.8.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for open and resolved risks
- Depends On: `docs/core/ARCHITECTURE.md`, `docs/core/DOMAIN_RULES.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `.github/workflows/lucaid-audit.yml`
- Owner: DG Gruppen
- Update Triggers: new risk identified, risk resolved, severity change, backend enforcement added

---

## Purpose

This is the risk register for SHF Intra. Every risk identified during AI analysis or code review should be recorded here.

**Cross-reference rule:** Every analysis finding must be checked against this file. If it matches an open risk, reference it. If it is new, add it.

---

## Open risks

### RISK-3: Storage bucket policies may not match folder access_roles
- **Severity:** Medium
- **Status:** Open
- **Area:** Documents (`Documents.tsx`, `useDocuments.tsx`, Storage bucket `documents`)
- **Description:** The `document_folders` table has `access_roles` and `write_roles` arrays checked by `has_folder_access()` and `has_folder_write_access()` RPC functions. However, the Supabase Storage bucket `documents` has its own independent policy. These two access control layers may not be synchronized.
- **Impact:** A user could potentially access a file directly via storage URL even if the folder's `access_roles` would deny them read access through the application.
- **Mitigation:** Storage URLs are signed with short expiry times in the application.
- **Resolution:** Align storage bucket policies with folder-level access control, or serve files exclusively through an Edge Function that checks `has_folder_access()`.
- **Identified:** 2026-03-21

### RISK-4: Content index dual-indexing divergence
- **Severity:** Medium
- **Status:** Open
- **Area:** AI Assistant (`content_index`, DB triggers, `sync-content-index`)
- **Description:** Content is indexed into `content_index` via two paths: realtime DB triggers (on INSERT/UPDATE) and nightly batch sync (`sync-content-index`). If a trigger fails silently, the index becomes stale until the nightly sync runs.
- **Impact:** AI assistant may return outdated or missing results for recently published content.
- **Mitigation:** Nightly sync acts as a catch-up mechanism.
- **Resolution:** Add trigger failure logging or alerting. Consider making the nightly sync more frequent (every 4 hours).
- **Identified:** 2026-03-21

### RISK-5: profiles.department is text, not FK
- **Severity:** Low
- **Status:** Open
- **Area:** Organization (`profiles`, `departments`, `OrgChartCanvas.tsx`)
- **Description:** `profiles.department` is a free-text string, not a foreign key to `departments.id` or `departments.name`. Department matching in the org chart is done via string equality.
- **Impact:** Typos or inconsistencies in department names cause employees to appear outside the org chart hierarchy. Renaming a department in `departments` does not automatically update `profiles`.
- **Mitigation:** Admin UI typically selects from existing departments, reducing typo risk.
- **Resolution:** Either add a FK from `profiles.department_id` → `departments.id`, or add a constraint/trigger to validate `profiles.department` against `departments.name`.
- **Identified:** 2026-03-21

### RISK-6: Admin panel is frontend-gated only
- **Severity:** Medium
- **Status:** Open
- **Area:** Admin (`Admin.tsx`, `useAdminAccess.tsx`)
- **Description:** The admin panel at `/admin` is gated by the `useAdminAccess` hook, which checks role and module permissions client-side. There is no server-side route guard or middleware that prevents non-admin users from making admin API calls.
- **Impact:** An attacker with any authenticated session could call admin-level Supabase queries (e.g., updating `modules`, `departments`, `groups`) if the RLS policies on those tables are permissive.
- **Mitigation:** Most admin tables have RLS that checks `has_role(auth.uid(), 'admin')`.
- **Resolution:** Audit all admin-managed tables to ensure RLS policies require admin role for INSERT/UPDATE/DELETE.
- **Identified:** 2026-03-21

### RISK-7: No explicit deny in permission model
- **Severity:** Low
- **Status:** Open
- **Area:** Permission system (`module_permissions`, `useModulePermission.tsx`)
- **Description:** The permission model uses OR accumulation — if any path grants access, access is granted. There is no mechanism to explicitly deny a user who has been granted access through another path (e.g., via group membership).
- **Impact:** It is impossible to block a specific user from a module if they belong to a group that has access.
- **Mitigation:** Low practical impact for an organization of ~50–200 users where access is typically granted, not revoked.
- **Resolution:** Accept as design decision, or add an explicit deny mechanism with higher priority than grants.
- **Identified:** 2026-03-21

---

## Resolved risks

### RISK-1: Client-driven order status transitions *(was High)*
- **Resolution Date:** 2026-03-21
- **Resolved By:** Migration `validate_order_status_transition` trigger
- **Resolution Summary:** Added a `BEFORE UPDATE` trigger on `orders` that enforces: (a) only valid transitions (pending→approved, pending→rejected, approved→delivered), (b) `rejection_reason IS NOT NULL` when rejecting, (c) only admin/IT roles can mark as delivered. Sub-finding RISK-1a (nullable rejection_reason) also resolved by the same trigger.

### RISK-2: AES encryption key returned to all authenticated users *(was High)*
- **Resolution Date:** 2026-03-21
- **Resolved By:** `get-passwords-key` Edge Function rewrite
- **Resolution Summary:** Added group membership check — the encryption key is now only returned to users with admin/IT role or who belong to at least one group linked to a shared password via `shared_password_groups`.

### RISK-8: Database backup — verify_jwt=false, wildcard CORS *(was Medium)*
- **Resolution Date:** 2026-03-21
- **Resolved By:** `database-backup` Edge Function rewrite + `config.toml` update
- **Resolution Summary:** Set `verify_jwt = true` in config.toml for defense-in-depth. Restricted CORS to production domain. Simplified admin check to use `has_role` RPC only.

### RISK-9: Email notifications bypass pgmq queue *(was Medium)*
- **Resolution Date:** 2026-03-21
- **Resolved By:** `enqueueEmail` helper (`src/lib/enqueueEmail.ts`) + call site migration
- **Resolution Summary:** All direct `supabase.functions.invoke("send-email", ...)` calls replaced with `supabase.rpc("enqueue_email", ...)` via a shared `enqueueEmail()` helper. Affected files: `orderEmails.ts`, `sendHelpdeskEmail.ts`, `OrderDetail.tsx`, `NewOrder.tsx`, `Onboarding.tsx`, `WorkwearOrder.tsx`.

### RISK-10: Approver can mark orders as delivered *(was High)*
- **Resolution Date:** 2026-03-21
- **Resolved By:** Migration `validate_order_status_transition` trigger (same as RISK-1)
- **Resolution Summary:** The trigger enforces admin/IT role check when `status = 'delivered'`, preventing approvers from marking orders as delivered via direct API calls.

### RISK-11: impersonate-user Edge Function rejects admins *(was Medium)*
- **Resolution Date:** 2026-03-21
- **Resolved By:** `impersonate-user` Edge Function rewrite
- **Resolution Summary:** Added parallel `has_role` check for both `it` and `admin` roles. Either role now grants impersonation access.
