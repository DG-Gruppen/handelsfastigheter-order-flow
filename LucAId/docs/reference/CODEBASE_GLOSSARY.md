## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.6.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for canonical term definitions, table names, and function names
- Depends On: `docs/SYSTEM_OVERVIEW.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `.github/workflows/lucaid-audit.yml`
- Owner: DG Gruppen
- Update Triggers: new term, role change, new table, function renamed

---

## Purpose

This file defines canonical terms for this codebase. Before inferring meaning from code, look here first.

**Rule:** If a term is defined here, use this definition. Do not infer alternate meanings from code patterns.

---

## Glossary

### Roles and access

| Term | Definition |
|------|------------|
| `employee` | Base role for all authenticated users. Can create orders, read content, use tools. |
| `manager` | Department head with order approval authority over subordinates. Derived via `profiles.manager_id`. |
| `staff` | Extended access role for STAB functions. Visible in org chart as staff position. |
| `it` | IT personnel role, admin-equivalent for panel access and impersonation. |
| `admin` | Full system access including user management, module configuration, backup. |
| Superadmin group | Hidden group (`is_system: true`, `role_equivalent: 'admin'`) filtered from public views. |
| Module permission | Granular access control per module: `can_view`, `can_edit`, `can_delete`, `is_owner`. |
| Role equivalent | `groups.role_equivalent` field mapping a group membership to an `app_role` value. |
| Impersonation | IT/admin feature to generate a session as another user. Server-verified. |

### Domain terms

| Term | Definition |
|------|------------|
| Order | IT equipment request with approval workflow. Status: pending → approved/rejected → delivered. |
| Onboarding | Specialized order type for new employee setup. Creates placeholder profile. |
| Offboarding | Specialized order type for departing employee equipment return. |
| Placeholder profile | Profile with `is_hidden: true` created during onboarding, linked to real user via `handle_new_user()`. |
| Auto-approval | Orders automatically approved when requester has no manager or is VD/STAB/IT. Client-side logic. |
| Recognition | Peer-to-peer appreciation message with icon, displayed on Culture page. |
| Celebration | Birthday or work anniversary derived from `profiles.birthday` / `profiles.start_date`. |
| Content index | Full-text + trigram search index (`content_index` table) fed by triggers and batch sync. |
| DLQ | Dead Letter Queue — pgmq queue for failed emails after max retries. |
| SHF-Assistenten | AI chatbot using `content_index` search + Lovable AI for response generation. |

### Tables and DB objects

| Term | Type | Definition |
|------|------|------------|
| `profiles` | Table | Extended user data linked to `auth.users` via `user_id`. |
| `user_roles` | Table | Role assignments (kept empty — roles derived via groups). |
| `groups` | Table | Named permission groups with `role_equivalent`. |
| `group_members` | Table | User ↔ group membership mapping. |
| `departments` | Table | Organizational hierarchy with `parent_id` self-reference. |
| `modules` | Table | Feature module registry with slug, route, icon. |
| `module_role_access` | Table | Default access per role per module. |
| `module_permissions` | Table | Granular per-user/group module overrides. |
| `orders` | Table | IT equipment order requests with approval workflow. |
| `order_items` | Table | Line items per order. |
| `order_types` | Table | Order type definitions (computer, phone, onboarding, etc.). |
| `categories` | Table | Equipment categories. |
| `systems` | Table | IT systems that can be linked to orders. |
| `document_folders` | Table | Hierarchical folders with `access_roles`/`write_roles`. |
| `document_files` | Table | File metadata with `storage_path` reference. |
| `shared_passwords` | Table | AES-encrypted password entries. |
| `shared_password_groups` | Table | Password ↔ group access mapping. |
| `password_access_log` | Table | Audit log for password views/copies. |
| `planner_boards` | Table | Kanban boards. |
| `planner_columns` | Table | Board columns with `wip_limit`. |
| `planner_cards` | Table | Kanban cards with assignee, priority, labels. |
| `planner_checklists` | Table | Card checklists. |
| `planner_checklist_items` | Table | Checklist items. |
| `planner_card_comments` | Table | Card comments. |
| `planner_card_attachments` | Table | Card file attachments. |
| `planner_activity_log` | Table | Board activity audit trail. |
| `news` | Table | News articles (internal + Cision). |
| `ceo_blog` | Table | CEO blog posts. |
| `content_index` | Table | Search index with `fts` tsvector column. |
| `kb_articles` | Table | Knowledge base articles. |
| `kb_videos` | Table | Knowledge base videos. |
| `kb_categories` | Table | KB category definitions. |
| `recognitions` | Table | Peer recognition messages. |
| `celebration_comments` | Table | Weekly celebration comments. |
| `notifications` | Table | In-app notifications. |
| `email_send_log` | Table | Email delivery audit log. |
| `email_send_state` | Table | Single-row rate limit configuration. |
| `suppressed_emails` | Table | Blocked email addresses. |
| `email_unsubscribe_tokens` | Table | Unsubscribe link tokens. |
| `workwear_orders` | Table | Workwear order requests with JSON items. |
| `tools` | Table | External tool directory. |
| `user_tool_favorites` | Table | User ↔ tool favorites. |
| `it_faq` | Table | IT support FAQ entries. |
| `org_chart_settings` | Table | Key-value settings for org chart display. |

### Functions and services

| Term | Type | Definition |
|------|------|------------|
| `has_role()` | RPC | Checks role via `user_roles` + group-derived roles. SECURITY DEFINER. |
| `has_module_permission()` | RPC | Checks user/group/role module access. SECURITY DEFINER. |
| `has_module_slug_permission()` | RPC | Same as above but by module slug. |
| `has_folder_access()` | RPC | Checks folder read access via `access_roles`. SECURITY DEFINER. |
| `has_folder_write_access()` | RPC | Checks folder write access. SECURITY DEFINER. |
| `has_shared_password_access()` | RPC | Checks password access via group membership. SECURITY DEFINER. |
| `get_subordinate_user_ids()` | RPC | Recursive CTE returning all subordinates of a manager. |
| `get_manager_user_ids()` | RPC | Returns all users with manager role. |
| `search_content()` | RPC | Hybrid fulltext + trigram search in `content_index`. |
| `create_notification()` | RPC | Creates in-app notification. SECURITY DEFINER. |
| `handle_new_user()` | Trigger | Creates/links profile on `auth.users` INSERT. |
| `enqueue_email()` | RPC | Adds email to pgmq queue. |
| `read_email_batch()` | RPC | Reads batch from pgmq queue. |
| `delete_email()` | RPC | Removes processed email from queue. |
| `move_to_dlq()` | RPC | Moves failed email to DLQ. |
| `ai-chat` | Edge Function | AI assistant using content_index + Lovable AI. |
| `fetch-cision-feed` | Edge Function | Cision RSS import (cron, no JWT). |
| `send-email` | Edge Function | Email dispatch via Resend API. |
| `process-email-queue` | Edge Function | pgmq queue processor (cron). |
| `database-backup` | Edge Function | Full DB export as JSON. |
| `get-passwords-key` | Edge Function | Returns AES encryption key (JWT only). |
| `impersonate-user` | Edge Function | Generates session for another user (IT/admin). |
| `sync-content-index` | Edge Function | Batch content index rebuild (cron). |

### Status values and enums

| Term | Used in | Meaning |
|------|---------|---------|
| `pending` | `orders.status` | Order awaiting approval |
| `approved` | `orders.status` | Order approved by manager/admin |
| `rejected` | `orders.status` | Order rejected with reason |
| `delivered` | `orders.status` | Order equipment delivered |
| `computer` | `orders.category` / `order_types.category` | Computer/laptop equipment |
| `phone` | `orders.category` / `order_types.category` | Phone/mobile equipment |
| `peripheral` | `orders.category` / `order_types.category` | Peripheral equipment |
| `other` | `orders.category` / `order_types.category` | Other equipment |
| `internal` | `news.source` | Internally created news article |
| `cision` | `news.source` | Imported from Cision RSS feed |
