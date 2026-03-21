## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.7.0
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

### RISK-1: Client-driven order status transitions
- **Severity:** High
- **Status:** Open
- **Area:** Orders (`NewOrder.tsx`, `OrderDetail.tsx`, `Onboarding.tsx`)
- **Description:** Order status transitions (pending → approved → delivered, pending → rejected) are performed via direct UPDATE from the client. There is no server-side state machine to validate that transitions are valid (e.g., preventing `rejected` → `delivered`).
- **Impact:** A user could craft API calls to set any valid `order_status` enum value on any order they can UPDATE, bypassing the intended approval workflow.
- **Mitigation:** RLS limits UPDATE to authenticated users; UI only shows valid transition buttons.
- **Resolution:** Add a database trigger or RPC function that validates state transitions server-side. Reject invalid transitions.
- **Identified:** 2026-03-21

### RISK-2: AES encryption key returned to all authenticated users
- **Severity:** High
- **Status:** Open
- **Area:** Passwords (`get-passwords-key` Edge Function, `Passwords.tsx`, `passwordCrypto.ts`)
- **Description:** The `get-passwords-key` Edge Function returns the AES encryption key to any authenticated user, regardless of group membership. Password data is protected by RLS (`has_shared_password_access()`), but the encryption key itself is universally accessible.
- **Impact:** If an attacker gains any authenticated session, they have the encryption key. Combined with a potential RLS bypass or direct DB access, all passwords could be decrypted.
- **Mitigation:** RLS on `shared_passwords` table limits which encrypted values a user can read. Without the encrypted data, the key alone is not useful.
- **Resolution:** Add group membership check in `get-passwords-key` Edge Function before returning the key. Alternatively, use per-group keys.
- **Identified:** 2026-03-21

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

### RISK-8: Database backup endpoint has no authentication
- **Severity:** High
- **Status:** Open
- **Area:** Admin (`database-backup` Edge Function, `DatabaseBackup.tsx`)
- **Description:** The `database-backup` Edge Function has `verify_jwt = false` in config.toml. This means anyone with the function URL can trigger a full database export without authentication.
- **Impact:** Complete data exfiltration of all 48 public tables including profiles, orders, passwords (encrypted), and email logs.
- **Mitigation:** The function URL is not publicly documented; the system is an internal tool.
- **Resolution:** Re-enable JWT verification (`verify_jwt = true`) and add admin role check inside the function. Pass the auth token from the client.
- **Identified:** 2026-03-21

---

## Resolved risks

*No resolved risks yet.*
