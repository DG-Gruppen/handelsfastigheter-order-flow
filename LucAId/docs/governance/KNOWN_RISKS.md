## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.7.1
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

### RISK-1: Client-driven order status transitions (no server-side state machine)
- **Severity:** High
- **Status:** Open
- **Area:** Orders (`NewOrder.tsx`, `OrderDetail.tsx`, `Onboarding.tsx`)
- **Description:** Order status transitions (pending → approved → delivered, pending → rejected) are performed via direct UPDATE from the client. There is no server-side state machine to validate that transitions are valid (e.g., preventing `rejected` → `delivered`). RLS limits UPDATE to the assigned approver (`approver_id = auth.uid()`) or admin — not any authenticated user — but the approver has unrestricted column-level write access.
- **Impact:** An approver could craft API calls to set any valid `order_status` enum value on orders they are assigned to, bypassing the intended approval workflow. An admin can do so on any order.
- **Sub-finding (RISK-1a):** `rejection_reason` column is nullable TEXT. Domain Rule §3 Rule 6 ("Rejection requires a rejection_reason") is enforced client-side only. A direct API call can reject with NULL reason.
- **Mitigation:** RLS limits UPDATE to approver or admin; UI only shows valid transition buttons.
- **Resolution:** Add a database trigger or RPC function that validates: (a) status can only advance along documented paths (pending→approved, pending→rejected, approved→delivered), (b) `rejection_reason IS NOT NULL` when `status = 'rejected'`. Escalation: CRITICAL.
- **Identified:** 2026-03-21
- **Last verified:** 2026-03-21 (LucAId audit — blast radius corrected from "any authenticated user" to "approver or admin")

### RISK-2: AES encryption key returned to all authenticated users
- **Severity:** High
- **Status:** Open
- **Area:** Passwords (`get-passwords-key` Edge Function, `Passwords.tsx`, `passwordCrypto.ts`)
- **Description:** The `get-passwords-key` Edge Function returns the AES encryption key to any authenticated user, regardless of group membership. Password data is protected by RLS (`has_shared_password_access()`), but the encryption key itself is universally accessible.
- **Impact:** If an attacker gains any authenticated session, they have the encryption key. Combined with a potential RLS bypass or direct DB access, all passwords could be decrypted.
- **Mitigation:** RLS on `shared_passwords` table limits which encrypted values a user can read. Without the encrypted data, the key alone is not useful.
- **Resolution:** Add group membership check in `get-passwords-key` Edge Function before returning the key. At minimum: verify the caller belongs to at least one group linked to any password via `shared_password_groups`.
- **Identified:** 2026-03-21
- **Last verified:** 2026-03-21 (LucAId audit — confirmed no role/group check in function)

### RISK-3: Storage bucket policies may not match folder access_roles
- **Severity:** Medium
- **Status:** Open
- **Area:** Documents (`Documents.tsx`, `useDocuments.tsx`, Storage bucket `documents`)
- **Description:** The `document_folders` table has `access_roles` and `write_roles` arrays checked by `has_folder_access()` and `has_folder_write_access()` RPC functions. However, the Supabase Storage bucket `documents` has its own independent policy. These two access control layers may not be synchronized.
- **Impact:** A user could potentially access a file directly via storage URL even if the folder's `access_roles` would deny them read access through the application.
- **Mitigation:** Storage URLs are signed with short expiry times in the application.
- **Resolution:** Align storage bucket policies with folder-level access control, or serve files exclusively through an Edge Function that checks `has_folder_access()`.
- **Identified:** 2026-03-21
- **Last verified:** 2026-03-21 (LucAId audit — storage bucket policies not accessible in migration files, status UNKNOWN)

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
- **Last verified:** 2026-03-21 (LucAId audit — confirmed in migration)

### RISK-6: Admin panel is frontend-gated only
- **Severity:** Medium
- **Status:** Open
- **Area:** Admin (`Admin.tsx`, `useAdminAccess.tsx`)
- **Description:** The admin panel at `/admin` is gated by the `useAdminAccess` hook, which checks role and module permissions client-side. There is no server-side route guard or middleware that prevents non-admin users from making admin API calls.
- **Impact:** An attacker with any authenticated session could call admin-level Supabase queries (e.g., updating `modules`, `departments`, `groups`) if the RLS policies on those tables are permissive.
- **Mitigation:** Most admin tables have RLS that checks `has_role(auth.uid(), 'admin')`.
- **Resolution:** Audit all admin-managed tables to ensure RLS policies require admin role for INSERT/UPDATE/DELETE.
- **Identified:** 2026-03-21
- **Last verified:** 2026-03-21 (LucAId audit — partially observed; full RLS audit across all admin tables UNKNOWN)

### RISK-7: No explicit deny in permission model
- **Severity:** Low
- **Status:** Open
- **Area:** Permission system (`module_permissions`, `useModulePermission.tsx`)
- **Description:** The permission model uses OR accumulation — if any path grants access, access is granted. There is no mechanism to explicitly deny a user who has been granted access through another path (e.g., via group membership).
- **Impact:** It is impossible to block a specific user from a module if they belong to a group that has access.
- **Mitigation:** Low practical impact for an organization of ~50–200 users where access is typically granted, not revoked.
- **Resolution:** Accept as design decision, or add an explicit deny mechanism with higher priority than grants.
- **Identified:** 2026-03-21
- **Last verified:** 2026-03-21 (LucAId audit — confirmed in PERMISSION_MODEL.md and useModules.tsx)

### RISK-8: Database backup — verify_jwt=false, manual auth is only gate
- **Severity:** Medium *(downgraded from High — manual auth exists but no gateway fallback)*
- **Status:** Open
- **Area:** Admin (`database-backup` Edge Function, `DatabaseBackup.tsx`)
- **Description:** The `database-backup` Edge Function has `verify_jwt = false` in config.toml. However, the function **does** implement manual JWT verification and admin role check (`auth.getUser()` + `has_role(..., 'admin')`). The real risk is defense-in-depth: `verify_jwt = false` means the Supabase gateway provides no rejection before the function receives the request, so the manual auth code is the sole gate. Additionally, CORS uses wildcard (`*`).
- **Impact:** If the manual auth code has a bug, there is no gateway fallback. Wildcard CORS on a data-export endpoint is a hygiene concern (though not directly exploitable since auth uses Authorization header, not cookies).
- **Mitigation:** Manual auth in function body validates JWT and checks admin role. CORS wildcard is not directly exploitable for CSRF with bearer tokens.
- **Resolution:** (a) Set `verify_jwt = true` in config.toml and pass the client's token in the request for defense-in-depth. (b) Restrict CORS to production domain.
- **Identified:** 2026-03-21
- **Last verified:** 2026-03-21 (LucAId audit — corrected from "no authentication" to "manual auth only, no gateway fallback")

### RISK-9: Email notifications bypass pgmq queue (sent directly from client)
- **Severity:** Medium
- **Status:** Open
- **Area:** Orders, Onboarding, Helpdesk, Workwear (`NewOrder.tsx`, `OrderDetail.tsx`, `Onboarding.tsx`, `orderEmails.ts`, `sendHelpdeskEmail.ts`, `WorkwearOrder.tsx`)
- **Description:** Multiple pages call `supabase.functions.invoke("send-email", ...)` directly, bypassing the pgmq queue system. This violates Domain Rules Global Invariant #4: "Email notifications must go through the pgmq queue system — never sent directly from client." All call sites use bare `try/catch` with `console.error` on failure — no retry, no DLQ, no `email_send_log` entry on failure.
- **Impact:** If the email provider returns a rate-limit (429) or transient error (5xx), the email is silently lost. No retry, no dead-letter queue routing, no audit trail for failed sends.
- **Mitigation:** None — direct calls have no fallback mechanism.
- **Resolution:** Replace all `supabase.functions.invoke("send-email", ...)` call sites with `supabase.rpc("enqueue_email", ...)` calls to route through pgmq. This restores retry/DLQ behaviour and aligns with the documented invariant.
- **Identified:** 2026-03-21 (LucAId audit finding F-1)

### RISK-10: Approver can mark orders as delivered (admin-only per domain rule)
- **Severity:** High
- **Status:** Open
- **Area:** Orders (`OrderDetail.tsx`, orders RLS policy)
- **Description:** The orders UPDATE RLS policy grants the assigned approver (`approver_id = auth.uid()`) unrestricted column-level write access, with no `WITH CHECK` clause restricting which columns or status values can be written. This allows an approver to set `status = 'delivered'` even though Domain Rule §3 Rule 5 requires admin-only delivery. The UI gates the "Markera som levererad" button behind `isAdmin`, but this is client-side only.
- **Impact:** An approver with direct API access can mark any of their assigned orders as delivered, bypassing the admin-only delivery requirement. They could also move a rejected order to delivered.
- **Mitigation:** UI only shows delivery button to admins.
- **Resolution:** Add a `WITH CHECK` clause to the orders UPDATE RLS, or add a trigger that checks: `IF NEW.status = 'delivered' THEN verify has_role(auth.uid(), 'admin')`. Escalation: CRITICAL.
- **Identified:** 2026-03-21 (LucAId audit finding F-2)

### RISK-11: impersonate-user Edge Function rejects admins (IT-only check)
- **Severity:** Medium
- **Status:** Open
- **Area:** Impersonation (`impersonate-user` Edge Function, `ImpersonateUserCard.tsx`)
- **Description:** The impersonation Edge Function checks `has_role(..., 'it')` exclusively at line 49. Admin users without the IT role are denied impersonation with a 403, despite documentation (PERMISSION_MODEL.md, WORKFLOW_MAPS.md WF-7) describing it as available to both IT and admin roles.
- **Impact:** Admin users who are not in the IT group cannot impersonate other users, contrary to documented behavior.
- **Mitigation:** In practice, admin users who need impersonation are typically also in the IT group.
- **Resolution:** Add a second `has_role` check for `admin` with OR logic, or update documentation to reflect IT-only access as intentional. Note: per CHANGE_SAFETY_RULES.md, "never relax the IT role check without explicit approval" — this is an addition, not a relaxation.
- **Identified:** 2026-03-21 (LucAId audit finding F-3)

---

## Resolved risks

*No resolved risks yet.*
