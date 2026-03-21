## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.6.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for permission sources, precedence order, and conflict resolution
- Depends On: `docs/SYSTEM_OVERVIEW.md`, `docs/core/ARCHITECTURE.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `docs/governance/KNOWN_RISKS.md`
- Owner: DG Gruppen
- Update Triggers: role change, permission precedence change, module access change

---

## Purpose

This file defines how access decisions are made in SHF Intra. It answers: *"Who can do what, and how is that determined?"*

Use this file when evaluating any access-control finding. Do not infer permission behavior from frontend code alone — frontend visibility is not authorization.

---

## Roles

| Role | Description | Key permissions |
|------|-------------|-----------------|
| `employee` | Base role for all authenticated users | Create orders, read news/KB, use tools, basic document access |
| `manager` | Department head with approval authority | Approve/reject orders from subordinates, view subordinate order history, org chart editing |
| `staff` | Extended access (STAB function) | Visible in org chart as staff function, extended module access |
| `it` | IT personnel, admin-equivalent for panel access | Impersonation, universal module access (owner/edit/view), search index management, FAQ management |
| `admin` | Full system access | All CRUD operations, user management, impersonation, module configuration, database backup |

---

## Permission sources

Access is determined by three mechanisms, evaluated in order:

### 1. Role assignment (via groups)
- Users are assigned to groups (`group_members` table)
- Groups have `role_equivalent` field mapping to `app_role` enum
- `has_role()` RPC function checks both `user_roles` table (kept empty) and group membership
- Roles accumulate with OR logic — a user in multiple groups gets the highest permission level

### 2. Module-level role access (`module_role_access`)
- Each module has default access per role in `module_role_access` table
- Checked via `has_module_permission()` RPC: first checks user-level, then group-level, then role-level

### 3. Module-level granular permissions (`module_permissions`)
- Per-user or per-group overrides with `can_view`, `can_edit`, `can_delete`, `is_owner`
- `grantee_type` is either `'user'` or `'group'`
- These override the role-level defaults

---

## Precedence order

1. **User-level `module_permissions`** (highest priority) — explicit grant/deny for a specific user
2. **Group-level `module_permissions`** — explicit grant/deny for groups the user belongs to
3. **Role-level `module_role_access`** — default access based on the user's derived role(s)
4. **Default deny** (lowest priority) — if no rule matches, access is denied

---

## Conflict resolution

- **OR accumulation for roles:** If a user belongs to multiple groups with different `role_equivalent` values, they get ALL roles (not just the highest)
- **OR accumulation for module permissions:** If any path grants access, access is granted
- **No explicit deny mechanism:** There is no way to explicitly deny a user who has been granted access via another path
- **Superadmin group:** A hidden group with `is_system: true` and `role_equivalent = 'admin'` exists; filtered from all public views but grants admin access

---

## Frontend vs backend enforcement

| Check | Frontend | Backend | Notes |
|-------|----------|---------|-------|
| Authentication (is user logged in?) | `ProtectedRoute` redirect | Supabase gateway JWT verification | ✅ Both layers |
| Role check (is user admin?) | `useAuth` role state | `has_role()` RPC in RLS policies | ✅ Both layers |
| Module access (can user see module?) | `useModulePermission` hook | `has_module_permission()` RPC in some RLS | ⚠️ Not all modules have RLS |
| Order approval authority | `OrderDetail.tsx` checks `approver_id` match | **None** — RLS allows any authenticated UPDATE | ❌ Frontend only |
| Order status transitions | `OrderDetail.tsx` shows buttons conditionally | **None** — any valid enum value accepted | ❌ Frontend only |
| Folder read access | `useDocuments` filters visible folders | `has_folder_access()` in RLS | ✅ Both layers |
| Folder write access | `useDocuments` checks write permission | `has_folder_write_access()` in RLS | ✅ Both layers |
| Password vault access | UI filters by group membership | `has_shared_password_access()` in RLS | ✅ Both layers (but key issuance has no group check) |
| Impersonation authority | Admin panel shows button for IT/admin | Edge Function verifies IT/admin role | ✅ Both layers |
| Admin panel visibility | `useAdminAccess` hook | **None** — admin pages are client-side gated | ❌ Frontend only |
| News/KB admin actions | Module permission check in component | **None** — RLS allows based on auth only | ⚠️ Partial |

> ⚠️ Frontend-only checks are UI conveniences, not security controls. All security-relevant checks must be in the backend column.

---

## Special access patterns

### Document folder hierarchy
- `access_roles` array on `document_folders` defines which roles can read
- `write_roles` array defines which roles can write
- `has_folder_access()` and `has_folder_write_access()` are SECURITY DEFINER functions that:
  1. Check if user has admin role → always grants access
  2. Check if user's roles intersect with folder's `access_roles`/`write_roles`
  3. Check module-level permission for `documents` module

### Password vault
- `shared_password_groups` links passwords to groups
- `has_shared_password_access()` checks if user belongs to any linked group
- RLS on `shared_passwords` uses this function for SELECT
- **But:** The AES encryption key (`get-passwords-key`) is returned to ALL authenticated users regardless of group membership

### Impersonation
- Only IT and admin roles can impersonate (verified server-side in Edge Function)
- Impersonation generates a real session token — the impersonated session has full access as the target user
- `ImpersonationBanner` component shows a visual indicator during impersonation

---

## Known gaps

Full entries in `governance/KNOWN_RISKS.md`.

| Gap | Risk ID | Severity |
|-----|---------|----------|
| No server-side order status state machine | RISK-1 | High |
| AES key issued without group check | RISK-2 | High |
| Admin panel is frontend-gated only | RISK-6 | Medium |
| No explicit deny in permission model | RISK-7 | Low |
