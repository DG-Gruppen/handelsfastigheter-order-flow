## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.4.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for DB table definitions, column contracts, key relationships, enum values, and known data constraints
- Depends On: `docs/SYSTEM_OVERVIEW.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `docs/core/DOMAIN_RULES.md`, `docs/core/ARCHITECTURE.md`, `docs/governance/KNOWN_RISKS.md`, `docs/reference/CODEBASE_GLOSSARY.md`
- Owner: DG Gruppen
- Update Triggers: new table, column added/removed/renamed, enum value added, constraint changed, RLS policy change, relationship changed

---

## Purpose and scope

This file is the authoritative reference for the SHF Intra database model. It defines:
- all tables, their purpose, and their key columns
- relationships between tables
- known enum types and allowed values
- documented constraints and access-control patterns at the data layer
- known data-layer risks

**This file does not own:** business rules (`core/DOMAIN_RULES.md`), permission precedence (`core/PERMISSION_MODEL.md`), or risk analysis (`governance/KNOWN_RISKS.md`). It owns the structural data facts those files reason about.

**See also:**
- `docs/SYSTEM_OVERVIEW.md` §5 — canonical table inventory (source for this file)
- `docs/core/ARCHITECTURE.md` — how the DB layer interacts with RLS, Edge Functions, and client
- `docs/core/PERMISSION_MODEL.md` — how `user_roles`, `groups`, `module_permissions` drive access
- `docs/reference/CODEBASE_GLOSSARY.md` — canonical term definitions for all table and column names

---

## Enum types

### `app_role`
Used in: `user_roles.role`, `module_role_access.role`, `groups.role_equivalent`

| Value | Description |
|-------|-------------|
| `admin` | Full system access, user management, impersonation |
| `it` | Admin-equivalent for panel access; can impersonate users |
| `manager` | Can approve/reject assigned orders; sees subordinate orders |
| `staff` | Extended access beyond employee (e.g. org chart visibility) |
| `employee` | Base authenticated access |

### `order_status`
Used in: `orders.status`

| Value | Description |
|-------|-------------|
| `pending` | Submitted, awaiting manager approval |
| `approved` | Approved by manager |
| `rejected` | Rejected by manager |
| `delivered` | Order fulfilled |
| `cancelled` | Order cancelled |

> ⚠️ Status transitions are client-driven — no server-side state machine enforces valid transition sequences. See `governance/KNOWN_RISKS.md`.

### `news_source`
Used in: `news.source`

| Value | Description |
|-------|-------------|
| `internal` | Created by editors within SHF Intra |
| `cision` | Auto-imported from Cision RSS/XML feed |

### `email_queue`
Used in: pgmq queue names

| Value | Description |
|-------|-------------|
| `auth_emails` | Auth-related email queue |
| `transactional_emails` | Order and notification email queue |
| `auth_emails_dlq` | Dead-letter queue for failed auth emails |
| `transactional_emails_dlq` | Dead-letter queue for failed transactional emails |

---

## Tables

### Core identity & access

#### `profiles`
Extends `auth.users`. One row per authenticated user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Matches `auth.users.id` |
| `user_id` | uuid | FK → `auth.users.id` |
| `full_name` | text | |
| `email` | text | |
| `department` | text | Denormalized; not FK to `departments` |
| `phone` | text | |
| `manager_id` | uuid | Self-referencing FK → `profiles.id` |
| `birthday` | date | Used by culture celebrations |
| `start_date` | date | Used by culture celebrations |
| `theme_preference` | text | |
| `is_hidden` | bool | Hides user from directory/org chart |
| `is_staff` | bool | Controls staff-tier visibility |
| `sort_order` | int | Manual sort for org chart |
| `title_override` | text | Overrides job title display |

**Constraints:**
- `manager_id` is self-referencing — circular references are possible and not guarded.
- `department` is a free-text field, not a FK to `departments`. Org chart matching relies on string equality.

#### `user_roles`
One row per role assignment per user. A user may have multiple roles.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid | FK → `auth.users.id` |
| `role` | app_role | Enum — see above |

#### `groups`
Named permission groups, optionally equivalent to a role.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `role_equivalent` | app_role | If set, members inherit this role |
| `is_system` | bool | System groups cannot be deleted |
| `color` | text | Display color |

#### `group_members`
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid | FK → `auth.users.id` |
| `group_id` | uuid | FK → `groups.id` |

#### `departments`
Self-referencing hierarchy.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `color` | text | |
| `parent_id` | uuid | Self-referencing FK → `departments.id` |

---

### Module system

#### `modules`
Registry of all feature modules.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | Display name |
| `slug` | text | Unique identifier (e.g. `home`, `nyheter`) |
| `route` | text | Frontend route (e.g. `/dashboard`) |
| `icon` | text | Lucide icon name |
| `is_active` | bool | Toggles module visibility |
| `sort_order` | int | |

#### `module_role_access`
Role-based module visibility defaults.

| Column | Type | Notes |
|--------|------|-------|
| `module_id` | uuid | FK → `modules.id` |
| `role` | app_role | |
| `has_access` | bool | |

#### `module_permissions`
Fine-grained per-user or per-group overrides.

| Column | Type | Notes |
|--------|------|-------|
| `module_id` | uuid | FK → `modules.id` |
| `grantee_type` | text | `'user'` or `'group'` |
| `grantee_id` | uuid | FK → `auth.users.id` or `groups.id` |
| `can_view` | bool | |
| `can_edit` | bool | |
| `can_delete` | bool | |
| `is_owner` | bool | |

**Permission resolution order:** `module_permissions` (user) → `module_permissions` (group) → `module_role_access` → default open.

#### `module_activity_log`
| Column | Type | Notes |
|--------|------|-------|
| `module_id` | uuid | FK → `modules.id` |
| `user_id` | uuid | |
| `action` | text | |
| `entity_type` | text | |
| `entity_id` | uuid | |

---

### Orders

#### `orders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `requester_id` | uuid | FK → `profiles.id` |
| `approver_id` | uuid | FK → `profiles.id` — assigned manager |
| `status` | order_status | Enum — see above |
| `category` | text | |
| `title` | text | |
| `order_type_id` | uuid | FK → `order_types.id` |
| `recipient_*` | text | Denormalized recipient fields |

**Constraints:**
- No column-level RLS restriction on `UPDATE` — approver can technically modify any field. See `governance/KNOWN_RISKS.md`.
- Status transitions are not enforced server-side.

#### `order_items`
| Column | Type | Notes |
|--------|------|-------|
| `order_id` | uuid | FK → `orders.id` |
| `name` | text | |
| `quantity` | int | |
| `category_id` | uuid | FK → `categories.id` |
| `order_type_id` | uuid | FK → `order_types.id` |

#### `order_types`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `category` | text | Enum (category slug) |
| `category_id` | uuid | FK → `categories.id` |
| `icon` | text | |
| `is_active` | bool | |

#### `categories`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `icon` | text | |
| `is_active` | bool | |
| `sort_order` | int | |

#### `systems`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `description` | text | |
| `icon` | text | |
| `is_active` | bool | |

#### `order_systems`, `order_type_departments`, `category_departments`
Junction tables. See SYSTEM_OVERVIEW §5 for full column list.

---

### Documents

#### `document_folders`
Self-referencing hierarchy with role-gated access.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `parent_id` | uuid | Self-referencing FK → `document_folders.id` |
| `access_roles` | text[] | Array of `app_role` values allowed to view |
| `write_roles` | text[] | Array of `app_role` values allowed to write |
| `icon` | text | |
| `created_by` | uuid | FK → `profiles.id` |

**Constraints:**
- Access is evaluated via DB functions `has_folder_access` and `has_folder_write_access`.
- Storage bucket (`documents`) RLS may not enforce folder-level access — URL bypass risk. See `governance/KNOWN_RISKS.md`.

#### `document_files`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `storage_path` | text | Path in Supabase `documents` storage bucket |
| `mime_type` | text | |
| `file_size` | int | |
| `folder_id` | uuid | FK → `document_folders.id` |
| `created_by` | uuid | FK → `profiles.id` |

---

### Passwords

#### `shared_passwords`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `service_name` | text | |
| `username` | text | |
| `password_value` | text | AES-encrypted client-side before storage |
| `url` | text | |
| `notes` | text | |
| `created_by` | uuid | FK → `profiles.id` |

#### `shared_password_groups`
| Column | Type | Notes |
|--------|------|-------|
| `password_id` | uuid | FK → `shared_passwords.id` |
| `group_id` | uuid | FK → `groups.id` |

**Constraints:**
- The AES key is returned by `get-passwords-key` Edge Function to any authenticated user regardless of group membership. Group membership check may be absent. See `governance/KNOWN_RISKS.md` — Critical risk.

#### `password_access_log`
| Column | Type | Notes |
|--------|------|-------|
| `password_id` | uuid | FK → `shared_passwords.id` |
| `user_id` | uuid | |
| `action` | text | |

---

### Planner

| Table | Key columns | Notes |
|-------|-------------|-------|
| `planner_boards` | `name`, `created_by`, `is_archived` | |
| `planner_columns` | `board_id`, `name`, `sort_order`, `wip_limit` | → `planner_boards` |
| `planner_cards` | `board_id`, `column_id`, `assignee_id`, `priority`, `due_date`, `labels` | → `planner_boards`, `planner_columns` |
| `planner_checklists` | `card_id`, `title`, `sort_order` | → `planner_cards` |
| `planner_checklist_items` | `checklist_id`, `text`, `checked` | → `planner_checklists` |
| `planner_card_comments` | `card_id`, `user_id`, `content` | → `planner_cards` |
| `planner_card_attachments` | `card_id`, `storage_path`, `uploaded_by` | → `planner_cards` |
| `planner_activity_log` | `board_id`, `user_id`, `action`, `entity_type` | → `planner_boards` |

---

### News & content

| Table | Key columns | Notes |
|-------|-------------|-------|
| `news` | `title`, `body`, `source` (news_source enum), `is_published`, `author_id` | Deduplication via `source_url` — Cision URL changes cause duplicates |
| `ceo_blog` | `title`, `excerpt`, `author`, `period` | |
| `content_index` | `source_table`, `source_id`, `title`, `content`, `fts` (tsvector) | Dual-indexed: realtime triggers + batch sync edge function |

---

### Knowledge base

| Table | Key columns | Notes |
|-------|-------------|-------|
| `kb_articles` | `title`, `content`, `slug`, `category_id`, `is_published`, `tags` | → `kb_categories` |
| `kb_videos` | `title`, `video_url`, `category_id`, `is_published`, `tags` | → `kb_categories` |
| `kb_categories` | `name`, `slug`, `is_active` | |

---

### Culture & recognition

| Table | Key columns | Notes |
|-------|-------------|-------|
| `recognitions` | `from_user_id`, `to_user_id`, `message`, `icon` | |
| `celebration_comments` | `user_id`, `week_key`, `message` | `week_key` is a string — no FK |

---

### Email system

| Table | Key columns | Notes |
|-------|-------------|-------|
| `email_send_log` | `message_id`, `template_name`, `recipient_email`, `status` | Audit log only |
| `email_send_state` | `retry_after_until`, `batch_size`, `send_delay_ms` | Single-row rate-limit config |
| `email_unsubscribe_tokens` | `email`, `token`, `used_at` | |
| `suppressed_emails` | `email`, `reason` | Checked before all sends |

---

### Other

| Table | Key columns | Notes |
|-------|-------------|-------|
| `notifications` | `user_id`, `title`, `type`, `is_read` | In-app notifications |
| `org_chart_settings` | `setting_key`, `setting_value` | Key-value store; readable pre-auth — see `governance/KNOWN_RISKS.md` |
| `tools` | `name`, `url`, `emoji`, `is_active` | External tool links |
| `user_tool_favorites` | `user_id`, `tool_id`, `sort_order` | → `tools` |
| `workwear_orders` | `user_id`, `items` (JSON), `status` | |
| `it_faq` | *(managed by IT/admin)* | IT FAQ entries |

---

## Key data constraints summary

| Constraint | Table(s) | Risk level |
|-----------|---------|------------|
| AES key returned regardless of group membership | `shared_passwords`, `shared_password_groups` | Critical |
| No column restriction on `orders UPDATE` for approvers | `orders` | High |
| `profiles.department` is free-text, not FK | `profiles`, `departments` | Medium |
| `document_files` storage bucket may bypass folder RLS | `document_files` | High |
| `org_chart_settings` readable pre-auth | `org_chart_settings` | Medium |
| Order status transitions client-driven only | `orders` | Medium |
| `content_index` dual-sync can diverge | `content_index` | Medium |
| Cision deduplication via `source_url` only | `news` | Low |

Full risk entries in `governance/KNOWN_RISKS.md`.
