## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.6.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for DB table definitions, column contracts, enum values, and known data constraints
- Depends On: `docs/SYSTEM_OVERVIEW.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `docs/core/DOMAIN_RULES.md`, `docs/core/ARCHITECTURE.md`, `docs/governance/KNOWN_RISKS.md`, `docs/reference/CODEBASE_GLOSSARY.md`
- Owner: DG Gruppen
- Update Triggers: new table, column added/removed/renamed, enum value added, constraint changed, RLS policy change

---

## Purpose

This file is the authoritative reference for the database model. It defines tables, column contracts, enum types, key relationships, and known data-layer constraints.

**This file does not own:** business rules (`core/DOMAIN_RULES.md`), permission precedence (`core/PERMISSION_MODEL.md`), or risk analysis (`governance/KNOWN_RISKS.md`). It owns the structural data facts those files reason about.

---

## Enum types

### `app_role`
Used in: `user_roles.role`, `module_role_access.role`, `groups.role_equivalent`

| Value | Description |
|-------|-------------|
| `employee` | Base role for all users |
| `manager` | Department head with approval authority |
| `staff` | Extended access (STAB function) |
| `it` | IT personnel, admin-equivalent |
| `admin` | Full system access |

### `order_status`
Used in: `orders.status`

| Value | Description |
|-------|-------------|
| `pending` | Awaiting approval |
| `approved` | Approved by manager/admin |
| `rejected` | Rejected with reason |
| `delivered` | Equipment delivered |

### `order_category`
Used in: `orders.category`, `order_types.category`

| Value | Description |
|-------|-------------|
| `computer` | Computers and laptops |
| `phone` | Phones and mobile devices |
| `peripheral` | Peripherals (monitors, keyboards, etc.) |
| `other` | Other equipment |

---

## Tables

### Identity & access

#### `profiles`
*Extended user profile linked to `auth.users`.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | Profile ID (NOT the auth user ID) |
| `user_id` | uuid | No | — | References `auth.users.id` |
| `full_name` | text | No | `''` | Display name |
| `email` | text | No | `''` | Email address |
| `department` | text | Yes | null | Free text — NOT FK to departments |
| `manager_id` | uuid | Yes | null | → `profiles.id` (self-referencing) |
| `phone` | text | Yes | null | — |
| `birthday` | date | Yes | null | For celebrations |
| `start_date` | date | Yes | null | For anniversary celebrations |
| `is_hidden` | bool | No | false | Hidden from public views (placeholder profiles) |
| `is_staff` | bool | Yes | null | Legacy STAB indicator |
| `sort_order` | int | Yes | null | Display order in org chart |
| `title_override` | text | Yes | null | Custom title for org chart |
| `theme_preference` | text | Yes | null | Light/dark mode preference |

**Constraints:**
- `user_id` is unique
- `manager_id` → `profiles.id` (self-referencing FK)

**RLS policies:**
- SELECT: All authenticated users
- UPDATE: Own profile only (matching `auth.uid()`)
- INSERT: System (via `handle_new_user()` trigger)

**Enforcement gaps:**
- `department` is free text, not FK — can drift from `departments.name`

#### `user_roles`
*Role assignments per user. Kept empty — roles derived via groups.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `user_id` | uuid | No | — | References `auth.users.id` |
| `role` | app_role | No | `'employee'` | — |

**Constraints:**
- UNIQUE(`user_id`, `role`)

**RLS policies:**
- SELECT: Authenticated users
- INSERT/UPDATE/DELETE: Admin only (via `has_role()`)

#### `groups`
*Named permission groups with optional role equivalence.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `name` | text | No | — | Group display name |
| `role_equivalent` | app_role | Yes | null | Maps group to a role |
| `is_system` | bool | Yes | false | Hidden from public views (Superadmin) |
| `color` | text | Yes | null | Display color |
| `description` | text | Yes | null | — |
| `created_by` | uuid | Yes | null | — |

**RLS policies:**
- SELECT: Authenticated users (filtered: `is_system = false` in UI)
- INSERT/UPDATE/DELETE: Admin only

#### `group_members`
*Maps users to groups.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `user_id` | uuid | No | — | — |
| `group_id` | uuid | No | — | → `groups.id` |

**Constraints:**
- `group_id` → `groups.id` (FK with CASCADE)

#### `departments`
*Organizational department hierarchy.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `name` | text | No | — | — |
| `color` | text | Yes | null | Display color |
| `parent_id` | uuid | Yes | null | → `departments.id` (self-ref) |

### Module system

#### `modules`
*Registry of feature modules.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `name` | text | No | — | Display name |
| `slug` | text | No | — | URL-safe identifier |
| `route` | text | No | — | React Router path |
| `icon` | text | No | `'Folder'` | Lucide icon name |
| `is_active` | bool | No | true | Controls visibility |
| `sort_order` | int | No | 0 | Display order |
| `description` | text | Yes | null | — |

#### `module_role_access`
*Default access per role per module.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `module_id` | uuid | No | — | → `modules.id` |
| `role` | app_role | No | — | — |
| `has_access` | bool | No | true | — |

#### `module_permissions`
*Granular per-user/group module permissions.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `module_id` | uuid | No | — | → `modules.id` |
| `grantee_type` | text | No | `'user'` | `'user'` or `'group'` |
| `grantee_id` | uuid | No | — | User ID or Group ID |
| `can_view` | bool | Yes | false | — |
| `can_edit` | bool | Yes | false | — |
| `can_delete` | bool | Yes | false | — |
| `is_owner` | bool | Yes | false | — |

### Orders

#### `orders`
*IT equipment order requests.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `requester_id` | uuid | No | — | Auth user ID |
| `approver_id` | uuid | Yes | null | Auth user ID of assigned approver |
| `status` | order_status | No | `'pending'` | — |
| `category` | order_category | No | `'other'` | — |
| `title` | text | No | — | — |
| `description` | text | Yes | null | — |
| `order_type_id` | uuid | Yes | null | → `order_types.id` |
| `category_id` | uuid | Yes | null | → `categories.id` |
| `recipient_name` | text | Yes | null | For onboarding orders |
| `recipient_department` | text | Yes | null | — |
| `recipient_start_date` | date | Yes | null | — |
| `recipient_type` | text | Yes | null | — |
| `order_reason` | text | Yes | null | — |
| `rejection_reason` | text | Yes | null | Required on rejection |
| `delivery_comment` | text | Yes | null | — |
| `approved_at` | timestamptz | Yes | null | — |

**RLS policies:**
- SELECT: Authenticated (own orders + subordinate orders for managers + all for admin)
- INSERT: Authenticated
- UPDATE: Authenticated (no column-level restriction — see RISK-1)

**Enforcement gaps:**
- No server-side state machine for status transitions
- No column-level UPDATE restriction (approver can change any field)

#### `order_items`
*Line items per order.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `order_id` | uuid | No | — | → `orders.id` |
| `name` | text | No | — | — |
| `quantity` | int | No | 1 | — |
| `category_id` | uuid | Yes | null | → `categories.id` |
| `order_type_id` | uuid | Yes | null | → `order_types.id` |
| `description` | text | Yes | null | — |

### Documents

#### `document_folders`
*Hierarchical folder structure with role-based access.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `name` | text | No | — | — |
| `parent_id` | uuid | Yes | null | → self (hierarchy) |
| `access_roles` | text[] | Yes | null | Roles that can read |
| `write_roles` | text[] | Yes | null | Roles that can write |
| `icon` | text | No | `'Folder'` | — |
| `sort_order` | int | No | 0 | — |
| `created_by` | uuid | No | — | — |

**RLS policies:**
- SELECT: `has_folder_access()` or admin
- INSERT/UPDATE/DELETE: `has_folder_write_access()` or admin

#### `document_files`
*Files stored in folders.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `folder_id` | uuid | No | — | → `document_folders.id` |
| `name` | text | No | — | — |
| `storage_path` | text | No | — | Path in Storage bucket |
| `mime_type` | text | No | `''` | — |
| `file_size` | int | No | 0 | Bytes |
| `created_by` | uuid | No | — | — |

### Passwords

#### `shared_passwords`
*AES-encrypted password entries.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `service_name` | text | No | — | — |
| `username` | text | No | `''` | — |
| `password_value` | text | No | `''` | AES-encrypted |
| `url` | text | No | `''` | — |
| `notes` | text | No | `''` | AES-encrypted |
| `created_by` | uuid | No | — | — |

**RLS policies:**
- SELECT: `has_shared_password_access()` (group-based)
- INSERT/UPDATE/DELETE: Admin/IT or creator

#### `password_access_log`
*Audit trail for password access.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | — |
| `password_id` | uuid | No | — | → `shared_passwords.id` |
| `user_id` | uuid | No | — | — |
| `action` | text | No | `'view'` | `view`, `copy`, etc. |

### Email

#### `email_send_state`
*Single-row rate limit configuration.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | int PK | No | — | Always 1 |
| `batch_size` | int | No | 10 | Emails per batch |
| `send_delay_ms` | int | No | 500 | Delay between sends |
| `retry_after_until` | timestamptz | Yes | null | Rate limit expiry |
| `auth_email_ttl_minutes` | int | No | 60 | — |
| `transactional_email_ttl_minutes` | int | No | 1440 | — |

---

## Key constraints summary

| Constraint | Table(s) | Risk level |
|-----------|---------|------------|
| No FK from `profiles.department` to `departments` | `profiles` | Low — see RISK-5 |
| No state machine on `orders.status` transitions | `orders` | High — see RISK-1 |
| No column-level UPDATE restriction on `orders` | `orders` | High — see RISK-1 |
| `email_send_state` single-row design | `email_send_state` | Low — accidental DELETE loses config |
| `groups.is_system` only filtered in frontend | `groups` | Medium — see RISK-6 |

Full risk entries in `governance/KNOWN_RISKS.md`.
