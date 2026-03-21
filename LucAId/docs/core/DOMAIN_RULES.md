## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.6.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for business rules and intended behavior per module. When a rule appears in multiple files, this file wins.
- Depends On: `docs/SYSTEM_OVERVIEW.md`
- Used By: `docs/core/WORKFLOW_MAPS.md`, `docs/governance/KNOWN_RISKS.md`
- Owner: DG Gruppen
- Update Triggers: business rule changes, module behavior change, lifecycle change

---

## Purpose

This file is the authoritative source for intended business behavior. It answers: *"What is this system supposed to do?"*

Use this file to evaluate whether a finding is a real bug (violates intended behavior) or a legitimate design choice.

**See also:**
- `docs/core/WORKFLOW_MAPS.md` — step-by-step maps of how rules are executed
- `docs/core/PERMISSION_MODEL.md` — how access rules are resolved
- `docs/reference/DATA_MODEL.md` — data constraints that enforce rules

---

## Global invariants

Rules that apply across all modules. These must never be violated.

1. All state-changing operations must be authenticated (no anonymous access).
2. Users may only modify data they own or are explicitly authorized to modify via role, group, or module permission.
3. Role resolution must always go through `has_role()` RPC — never inferred from client-side state alone.
4. Email notifications must go through the pgmq queue system — never sent directly from client.
5. All module visibility is controlled by the `modules` table `is_active` flag and role/permission checks.

---

## Module rules

---

### §1 Authentication

**Purpose:** Manages user sessions and identity.

**Rules:**
1. Login is email + password via Supabase Auth.
2. On first login, the `handle_new_user()` trigger creates or links a `profiles` row.
3. Session tokens are managed by Supabase Auth; the client stores them in localStorage.
4. There is no SSO/SAML — all authentication is email/password.
5. Email verification is required before login (auto-confirm is disabled).

**Enforcement:** Supabase Auth (trusted).

---

### §2 Role resolution

**Purpose:** Determines what a user can do.

**Rules:**
1. Roles are derived from `group_members` → `groups.role_equivalent`, NOT from direct assignment in `user_roles` (which is kept empty).
2. `has_role()` checks both `user_roles` and group-derived roles (OR logic).
3. A user may have multiple roles simultaneously; all accumulate.
4. A hidden Superadmin group (`is_system: true`) grants admin access and is filtered from all public views.
5. The `it` role is treated as admin-equivalent for panel access and impersonation.

**Enforcement:** Database (RPC function `has_role()` — SECURITY DEFINER).

---

### §3 Orders (IT equipment)

**Purpose:** Request, approve, and track IT equipment orders.

**Rules:**
1. Any authenticated user can create an order.
2. Orders are assigned to the requester's manager (via `profiles.manager_id`) as approver.
3. If the requester has no manager, or is VD/STAB/IT, the order is auto-approved.
4. Only the assigned approver or admin can approve/reject an order.
5. Only admin can mark an order as delivered.
6. Rejection requires a `rejection_reason`.

**Lifecycle / states:**

| State | Meaning | Valid transitions |
|-------|---------|------------------|
| `pending` | Awaiting approval | → `approved`, → `rejected` |
| `approved` | Approved by manager/admin | → `delivered` |
| `rejected` | Rejected with reason | *(terminal)* |
| `delivered` | Equipment delivered | *(terminal)* |

**Enforcement:** Status transitions are **client-side only** — no server-side state machine. See RISK-1.

---

### §4 Onboarding / Offboarding

**Purpose:** Streamlined order creation for new hires or departing employees.

**Rules:**
1. Creates an order of type onboarding/offboarding with a placeholder profile for the new employee.
2. The placeholder profile has `is_hidden: true` until linked to a real `auth.users` entry via `handle_new_user()`.
3. Manager field is locked to the requester's department.
4. Auto-approval applies when the requester is VD, STAB, IT, or a manager without a superior.
5. The onboarding order includes recipient information (`recipient_name`, `recipient_department`, `recipient_start_date`).

**Enforcement:** Client-side logic; placeholder linking is via database trigger.

---

### §5 News

**Purpose:** Internal news articles and Cision press release imports.

**Rules:**
1. Any authenticated user can read published news.
2. Admin or users with `nyheter.edit` module permission can create/edit news.
3. Cision news is imported automatically every 12 hours via `fetch-cision-feed`.
4. Cision articles are deduplicated by `source_url` — existing URLs are skipped.
5. Imported articles get `source: 'cision'`, `is_published: true`.
6. News is displayed in reverse chronological order by `published_at`, with pagination after 8 articles.

**Enforcement:** RLS for read; module permission for write; Edge Function for import.

---

### §6 Knowledge Base

**Purpose:** Articles and videos organized by category with rich text editing.

**Rules:**
1. Any authenticated user can read published articles and videos.
2. Admin or users with `kunskapsbanken.edit` can manage content.
3. Articles use TipTap rich text editor with image support.
4. Videos have thumbnail URLs and optional duration.
5. Published articles/videos are indexed into `content_index` via triggers.

**Enforcement:** RLS for read; module permission for write.

---

### §7 Documents

**Purpose:** Hierarchical file storage with role-based access control per folder.

**Rules:**
1. Each folder has `access_roles` (read) and `write_roles` (write) arrays.
2. Admin always has full access regardless of folder settings.
3. Access is checked via `has_folder_access()` and `has_folder_write_access()` SECURITY DEFINER functions.
4. Files are stored in a private Supabase Storage bucket `documents`.
5. File metadata is stored in `document_files` with references to `document_folders`.

**Enforcement:** Database (RLS + SECURITY DEFINER functions) for data access. Storage bucket policies for file access.

---

### §8 Planner (Kanban)

**Purpose:** Kanban-style project planning with boards, columns, and cards.

**Rules:**
1. Any authenticated user can create boards and cards.
2. Admin or users with `planner.edit` can manage boards (rename, archive, delete).
3. Columns have optional WIP (Work In Progress) limits.
4. Cards have assignees, due dates, priority levels, labels, checklists, and comments.
5. Card assignment creates a notification for the assignee.
6. Card comments create notifications for the card reporter and assignee.
7. Board activity is logged to `planner_activity_log`.
8. Cards and columns support drag-and-drop reordering via dnd-kit.

**Enforcement:** RLS for data access; notification triggers in database.

---

### §9 Passwords

**Purpose:** Shared password vault with client-side AES encryption.

**Rules:**
1. Passwords are encrypted client-side using AES before storage.
2. The AES key is retrieved from `get-passwords-key` Edge Function.
3. Access to individual passwords is controlled by group membership via `shared_password_groups`.
4. `has_shared_password_access()` checks if the user belongs to any group linked to the password.
5. All password access (view, copy) is logged to `password_access_log`.
6. Admin and IT can view the access log.

**Known issue:** The AES key is returned to ALL authenticated users, not just those with password access. See RISK-2.

**Enforcement:** RLS for password data (group-based); JWT only for key issuance.

---

### §10 Culture

**Purpose:** Employee recognition and celebrations (birthdays, anniversaries).

**Rules:**
1. Any authenticated user can send recognitions to other users.
2. Celebrations are derived from `profiles.birthday` and `profiles.start_date`.
3. Celebration comments are grouped by `week_key` (ISO week format).
4. Recognitions have icons and messages.

**Enforcement:** RLS for data access.

---

### §11 Organization Chart

**Purpose:** Visual org chart showing company hierarchy.

**Rules:**
1. All authenticated users can view the org chart.
2. Admin can edit org chart settings and move employees between departments.
3. The chart is rendered as SVG canvas with collapsible nodes.
4. Node collapse state is stored in localStorage.
5. `profiles.department` is free text matching `departments.name` — NOT a foreign key.

**Enforcement:** Client-side rendering; profile data via RLS.

---

### §12 Workwear

**Purpose:** Ordering company workwear.

**Rules:**
1. Any authenticated user can place workwear orders.
2. Orders store items as JSON in `workwear_orders.items`.
3. Workwear seasons trigger reminder notifications via `notify-workwear-season`.

**Enforcement:** RLS for data access.

---

### §13 Tools

**Purpose:** Directory of external tools and services.

**Rules:**
1. All authenticated users can view and use tools.
2. Users can mark tools as favorites (`user_tool_favorites`).
3. Admin can manage tools (CRUD).
4. Tools have sort order and active/inactive status.

**Enforcement:** RLS for data access.

---

### §14 IT Support

**Purpose:** IT FAQ and support information.

**Rules:**
1. All authenticated users can read FAQ.
2. Admin or users with `it-support.edit` can manage FAQ entries.

**Enforcement:** RLS for read; module permission for write.

---

### §15 Email System

**Purpose:** Transactional email delivery via pgmq queues.

**Rules:**
1. Emails are enqueued via `enqueue_email()` RPC into pgmq queues (`auth_emails`, `transactional_emails`).
2. `process-email-queue` Edge Function processes queues on a schedule.
3. Failed emails are moved to DLQ after max retries.
4. Rate limiting is configured in `email_send_state` table (single row).
5. Suppressed emails (`suppressed_emails` table) are never sent to.
6. Unsubscribe tokens are generated per recipient.

**Enforcement:** Database (pgmq) + Edge Function + Resend API.

---

### §16 AI Assistant (SHF-Assistenten)

**Purpose:** AI-powered Q&A using indexed content.

**Rules:**
1. Available to all authenticated users via floating chat bubble.
2. Searches `content_index` using hybrid fulltext + trigram search (`search_content()` RPC).
3. Content is indexed from: news, KB articles, KB videos, IT FAQ, CEO blog, tools, departments, documents.
4. Indexing happens via both triggers (realtime) and batch sync (nightly `sync-content-index`).
5. AI responses are generated using Lovable AI models.

**Enforcement:** JWT required for Edge Function; content access via RLS.

---

### §17 Risk summary

Pointer table — full entries in `governance/KNOWN_RISKS.md`.

| Risk ID | Summary | Severity | Status |
|---------|---------|----------|--------|
| RISK-1 | Order status transitions are client-driven, no server-side state machine | High | Open |
| RISK-2 | AES encryption key returned to all authenticated users | High | Open |
| RISK-3 | Storage bucket policies may not match folder access_roles | Medium | Open |
| RISK-4 | Content index dual-indexing divergence risk | Medium | Open |
| RISK-5 | profiles.department is text, not FK to departments | Low | Open |
| RISK-6 | Admin panel is frontend-gated only | Medium | Open |
| RISK-7 | No explicit deny in permission model | Low | Open |
