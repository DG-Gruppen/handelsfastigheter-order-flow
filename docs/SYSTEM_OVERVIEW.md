# SYSTEM_OVERVIEW.md

## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- Generated: 2026-03-21
- Confidence: high (based on full codebase analysis)

---

## 1. System purpose

**SHF Intra** is the internal intranet and operations platform for Svenska Handelsfastigheter (SHF), a Swedish commercial real estate company that owns, develops, and manages retail properties across ~150 municipalities. The system serves all employees (~50–200 users based on org structure) and provides a unified workspace for IT equipment ordering, knowledge management, internal news, document storage, project planning, HR/culture features, and an AI-powered assistant. It replaces fragmented workflows with a single authenticated web application accessible at `https://intra.handelsfastigheter.se`. The system is built as a React SPA with a Supabase backend (Lovable Cloud), using Edge Functions for server-side logic, and integrates with Google Workspace for SSO, Resend for transactional email, Firecrawl for web scraping, and Cision for press release syndication.

---

## 2. User roles

Roles are stored in a separate `user_roles` table using the `app_role` enum. Roles can also be derived from group membership via `groups.role_equivalent`.

| Role | Description | Key permissions |
|------|-------------|-----------------|
| `admin` | System administrators | Full CRUD on all tables, all admin sections, database backup, user management, module configuration, impersonation (via IT) |
| `it` | IT support staff | Equivalent to admin for admin panel access; can impersonate users; manages IT FAQ, passwords, and helpdesk |
| `manager` | Department managers | Can approve/reject orders assigned to them; view subordinate orders; standard module access |
| `staff` | Staff-level employees | Extended access to certain modules beyond basic employee (e.g., org chart visibility) |
| `employee` | Standard employees | Base access: can create orders, view own orders, access modules permitted by group/role rules |

**Permission resolution order**: Explicit module_permissions (user or group) → role-based module_role_access → default (no rules = accessible to all).

---

## 3. Modules and feature areas

Each module is registered in the `modules` table with a slug, route, icon, and active flag. Access is controlled via `module_role_access` and `module_permissions`.

| Module | Slug | Route | Purpose | Access control | DB tables |
|--------|------|-------|---------|----------------|-----------|
| Dashboard | `home` | `/dashboard` | Landing page with KPIs, news feed, recognitions, celebrations, quick tools | All authenticated users | `recognitions`, `news`, `tools`, `user_tool_favorites` |
| Nyheter (News) | `nyheter` | `/nyheter` | Internal news + auto-imported Cision press releases; filterable by category | All authenticated; editors can manage | `news` (source column distinguishes internal vs cision) |
| Kunskapsbanken (KB) | `kunskapsbanken` | `/kunskapsbanken` | Articles and video tutorials with categories, tags, rich text editing | All authenticated (published only); editors manage | `kb_articles`, `kb_videos`, `kb_categories` |
| Dokument (Documents) | `documents` | `/dokument` | Hierarchical folder-based document storage with role-gated access | Folder-level access_roles + write_roles; module permissions | `document_folders`, `document_files`; Storage bucket: `documents` |
| Beställningar (New Order) | `new-order` | `/orders/new` | IT equipment ordering (computers, phones, peripherals) with category/type selection | All authenticated | `orders`, `order_items`, `order_systems`, `order_types`, `categories`, `systems` |
| Onboarding | `onboarding` | `/onboarding` | New employee onboarding checklist/workflow | All authenticated | Reuses order tables |
| Orderhistorik (History) | `history` | `/history` | View and filter past orders | All authenticated (own orders); managers see assigned; admins see all | `orders`, `order_items` |
| Organisation (Org Chart) | `org` | `/org` | Interactive org chart with department hierarchy and manager relationships | All authenticated | `profiles`, `departments`, `org_chart_settings` |
| Personal (Personnel) | `personnel` | `/personal` | Employee directory with search, department filtering, birthdays, anniversaries | All authenticated | `profiles`, `departments` |
| Kulturen (Culture) | `kulturen` | `/kulturen` | Peer recognitions, weekly celebrations (birthdays/anniversaries), celebration comments | All authenticated | `recognitions`, `celebration_comments`, `profiles` |
| IT-Support | `it-support` | `/it-info` | IT FAQ, helpdesk email, system information | All authenticated; IT/admin manage FAQ | `it_faq` |
| Planner | `planner` | `/planner` | Kanban project boards with columns, cards, checklists, comments, attachments, activity log | All authenticated; editors manage boards | `planner_boards`, `planner_columns`, `planner_cards`, `planner_checklists`, `planner_checklist_items`, `planner_card_comments`, `planner_card_attachments`, `planner_activity_log` |
| Verktyg (Tools) | `tools` | `/verktyg` | External tool links with favorites; admin can manage tool list | All authenticated | `tools`, `user_tool_favorites` |
| Lösenord (Passwords) | `losenord` | `/losenord` | Shared password vault with client-side encryption; group-scoped access | Group-based access via `shared_password_groups` | `shared_passwords`, `shared_password_groups`, `password_access_log` |
| Arbetskläder (Workwear) | `workwear` | `/arbetsklader` | Seasonal workwear ordering with predefined product catalog | All authenticated; admin manages seasons | `workwear_orders` |
| Mitt SHF (My SHF) | `my-shf` | `/mitt-shf` | Personal page *(inferred — verify against source)* | All authenticated | — |
| Profil (Profile) | — | `/profile` | User profile editing (name, phone, theme preference) | Own profile only | `profiles` |
| Admin | — | `/admin` | Admin panel with tabs: categories, equipment, systems, knowledge, news, tools, users, groups, permissions, settings, IT, backup, workwear | Admin/IT role OR module-level edit permission on mapped slug | Multiple tables |

**Complexity notes:**
- The **Planner** module is the most table-heavy feature (7 tables, drag-and-drop, realtime).
- **Documents** has complex RLS with recursive folder access checks.
- **Passwords** uses client-side AES encryption with a server-held key (via `get-passwords-key` edge function).

---

## 4. Navigation structure

### Layout
- **Desktop**: Persistent sidebar (`AppSidebar`) with collapsible category groups, user profile popover, notification bell. Sidebar groups are drag-reorderable.
- **Mobile**: Top header (logo + notifications) + bottom tab bar (dashboard + Information modules) + "Meny" sheet for overflow modules.
- **Shell**: `LayoutRoute` wraps all authenticated routes with `AppLayout` (sidebar + main content + AI chat bubble + impersonation banner).

### Routes

| Path | Component | Access requirement |
|------|-----------|-------------------|
| `/login` | `Login` | Public (redirects to `/dashboard` if authenticated) |
| `/` | Redirect → `/dashboard` | — |
| `/dashboard` | `Dashboard` | Authenticated |
| `/orders/new` | `NewOrder` | Authenticated + module access |
| `/onboarding` | `Onboarding` | Authenticated + module access |
| `/orders/:id` | `OrderDetail` | Authenticated (RLS: own/approver/admin) |
| `/history` | `History` | Authenticated + module access |
| `/admin` | `Admin` | Authenticated + (admin/IT role OR hasAnyEditAccess) |
| `/org` | `OrgTree` | Authenticated + module access |
| `/it-info` | `ITInfo` | Authenticated + module access |
| `/personal` | `Personnel` | Authenticated + module access |
| `/dokument` | `Documents` | Authenticated + module access |
| `/kunskapsbanken` | `KnowledgeBase` | Authenticated + module access |
| `/mitt-shf` | `MySHF` | Authenticated + module access |
| `/planner` | `Planner` | Authenticated + module access |
| `/verktyg` | `Tools` | Authenticated + module access |
| `/losenord` | `Passwords` | Authenticated + module access |
| `/kulturen` | `Culture` | Authenticated + module access |
| `/nyheter` | `News` | Authenticated + module access |
| `/arbetsklader` | `Workwear` | Authenticated + module access |
| `/profile` | `Profile` | Authenticated |
| `*` | `NotFound` | Authenticated |

**Route protection**: `ProtectedRoute` checks: authentication → `isRouteDisabled` (nav settings) → admin special case → `useModuleAccess`.

---

## 5. Database tables

### Core identity & access

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `profiles` | User profiles (linked to auth.users) | `user_id`, `full_name`, `email`, `department`, `phone`, `manager_id`, `birthday`, `start_date`, `theme_preference`, `is_hidden`, `is_staff`, `sort_order`, `title_override` | `manager_id` → self-referencing `profiles.id` |
| `user_roles` | Role assignments | `user_id`, `role` (app_role enum) | — |
| `groups` | Permission groups | `name`, `role_equivalent`, `is_system`, `color` | — |
| `group_members` | Group membership | `user_id`, `group_id` | `group_id` → `groups.id` |
| `departments` | Organizational departments | `name`, `color`, `parent_id` | Self-referencing hierarchy |

### Module system

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `modules` | Registered feature modules | `name`, `slug`, `route`, `icon`, `is_active`, `sort_order` | — |
| `module_role_access` | Role-based module visibility | `module_id`, `role`, `has_access` | → `modules.id` |
| `module_permissions` | Fine-grained user/group permissions | `module_id`, `grantee_type`, `grantee_id`, `can_view`, `can_edit`, `can_delete`, `is_owner` | → `modules.id` |
| `module_activity_log` | Audit log for module actions | `module_id`, `user_id`, `action`, `entity_type`, `entity_id` | → `modules.id` |

### Orders

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `orders` | Equipment order requests | `requester_id`, `approver_id`, `status` (enum), `category`, `title`, `order_type_id`, `recipient_*` | → `order_types.id`, `categories.id` |
| `order_items` | Line items within orders | `order_id`, `name`, `quantity`, `category_id`, `order_type_id` | → `orders.id` |
| `order_types` | Equipment type definitions | `name`, `category` (enum), `category_id`, `icon`, `is_active` | → `categories.id` |
| `order_type_departments` | Which departments see which order types | `order_type_id`, `department_id` | → `order_types`, `departments` |
| `order_systems` | Systems linked to an order | `order_id`, `system_id` | → `orders`, `systems` |
| `categories` | Order categories | `name`, `icon`, `is_active`, `sort_order` | — |
| `category_departments` | Category-department mapping | `category_id`, `department_id` | → `categories`, `departments` |
| `systems` | IT systems catalog | `name`, `description`, `icon`, `is_active` | — |

### News & content

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `news` | Internal news + imported Cision releases | `title`, `body`, `excerpt`, `category`, `emoji`, `is_published`, `is_pinned`, `source` ('internal'/'cision'), `source_url`, `author_id`, `published_at` | — |
| `ceo_blog` | CEO blog entries | `title`, `excerpt`, `author`, `period` | — |
| `content_index` | Unified search index for AI assistant | `source_table`, `source_id`, `title`, `content`, `metadata`, `fts` (tsvector) | — |

### Knowledge base

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `kb_articles` | Knowledge base articles | `title`, `content`, `excerpt`, `slug`, `author_id`, `category_id`, `is_published`, `tags`, `views` | → `kb_categories.id` |
| `kb_videos` | Knowledge base videos | `title`, `description`, `video_url`, `thumbnail_url`, `author_id`, `category_id`, `is_published`, `tags`, `views` | → `kb_categories.id` |
| `kb_categories` | KB category taxonomy | `name`, `slug`, `icon`, `is_active`, `sort_order` | — |

### Documents

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `document_folders` | Folder hierarchy | `name`, `parent_id`, `access_roles`, `write_roles`, `icon`, `created_by` | Self-referencing |
| `document_files` | Uploaded files | `name`, `storage_path`, `mime_type`, `file_size`, `folder_id`, `created_by` | → `document_folders.id` |

### Planner

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `planner_boards` | Kanban boards | `name`, `description`, `created_by`, `is_archived` | — |
| `planner_columns` | Board columns | `board_id`, `name`, `color`, `sort_order`, `wip_limit` | → `planner_boards.id` |
| `planner_cards` | Task cards | `board_id`, `column_id`, `title`, `description`, `assignee_id`, `reporter_id`, `priority`, `due_date`, `labels`, `cover_color` | → `planner_boards`, `planner_columns` |
| `planner_checklists` | Card checklists | `card_id`, `title`, `sort_order` | → `planner_cards.id` |
| `planner_checklist_items` | Checklist items | `checklist_id`, `text`, `checked`, `sort_order` | → `planner_checklists.id` |
| `planner_card_comments` | Card comments | `card_id`, `user_id`, `content` | → `planner_cards.id` |
| `planner_card_attachments` | Card file attachments | `card_id`, `file_name`, `storage_path`, `uploaded_by` | → `planner_cards.id` |
| `planner_activity_log` | Board activity audit trail | `board_id`, `user_id`, `action`, `entity_type`, `entity_name` | → `planner_boards.id` |

### Culture & recognition

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `recognitions` | Peer-to-peer recognition messages | `from_user_id`, `to_user_id`, `message`, `icon` | — |
| `celebration_comments` | Comments on weekly celebration cards | `user_id`, `week_key`, `message` | — |

### Passwords

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `shared_passwords` | Encrypted shared credentials | `service_name`, `username`, `password_value` (encrypted), `url`, `notes`, `created_by` | — |
| `shared_password_groups` | Group access to passwords | `password_id`, `group_id` | → `shared_passwords`, `groups` |
| `password_access_log` | Audit log for password views | `password_id`, `user_id`, `action` | → `shared_passwords` |

### Workwear

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `workwear_orders` | Workwear order submissions | `user_id`, `items` (JSON), `notes`, `status` | — |

### Email system

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `email_send_log` | Audit log for sent emails | `message_id`, `template_name`, `recipient_email`, `status`, `error_message` | — |
| `email_send_state` | Rate-limit state and queue config | `retry_after_until`, `batch_size`, `send_delay_ms`, `auth_email_ttl_minutes` | — |
| `email_unsubscribe_tokens` | Unsubscribe tokens for emails | `email`, `token`, `used_at` | — |
| `suppressed_emails` | Suppressed email addresses | `email`, `reason` | — |

### Other

| Table | Purpose | Key columns | Relationships |
|-------|---------|-------------|---------------|
| `notifications` | In-app notifications | `user_id`, `title`, `message`, `type`, `reference_id`, `is_read` | — |
| `org_chart_settings` | Key-value settings (nav toggles, IT config, theme defaults) | `setting_key`, `setting_value` | — |
| `tools` | External tool links | `name`, `url`, `emoji`, `description`, `is_active`, `is_starred` | — |
| `user_tool_favorites` | Personal tool favorites | `user_id`, `tool_id`, `sort_order` | → `tools.id` |

---

## 6. Supabase Edge Functions

| Function | Purpose | Caller | JWT required | Key inputs | Key outputs |
|----------|---------|--------|-------------|------------|-------------|
| `ai-chat` | AI assistant (SHF-Assistenten) — searches content_index, streams response from Lovable AI gateway | Frontend (`AiChatBubble`) | Yes | `{ messages: Msg[] }` | SSE stream of AI completion |
| `send-email` | Direct email sending via Resend API | Frontend (helpdesk forms) | Yes | `{ to, subject, html, text }` | `{ success, id }` |
| `process-email-queue` | Batch processes pgmq email queues (auth + transactional) with retry, DLQ, rate limiting | pg_cron (service_role only) | Yes (service_role) | — | `{ processed: number }` |
| `fetch-cision-feed` | Fetches Cision RSS/XML press releases and auto-imports to `news` table | pg_cron (every 12h) + frontend on News page load | No | `{ triggered_by? }` | `{ releases[], sync: { imported } }` |
| `database-backup` | Exports all tables as JSON | Admin UI | Yes (admin check) | — | JSON backup file |
| `get-passwords-key` | Returns AES encryption key for password vault | Password page | Yes | — | `{ key }` |
| `impersonate-user` | Generates session tokens for another user (IT support tool) | Admin panel | Yes (IT role check) | `{ target_user_id }` | `{ access_token, refresh_token, full_name }` |
| `scrape-website` | Scrapes handelsfastigheter.se via Firecrawl, indexes to content_index | pg_cron (nightly at 02:00) / Admin | Yes | `{ url?, limit? }` | `{ indexed, total_urls }` |
| `scrape-allabolag` | Scrapes SHF company data from allabolag.se via Firecrawl | pg_cron (nightly at 02:00) / Admin | — | `{ additional_urls? }` | `{ indexed, companies[] }` |
| `sync-content-index` | Full re-index of all content sources into content_index table | Admin / pg_cron | Yes | — | `{ indexed }` |
| `cleanup-notifications` | Deletes read notifications older than 7 days | pg_cron | No *(inferred)* | — | `{ deleted }` |
| `import-google-workspace` | Syncs employee data from Google Workspace CSV export | Admin UI | — | `{ users: GWUser[] }` | `{ results[] }` |
| `notify-workwear-season` | Sends notification to all users about new workwear ordering season | Admin workwear panel | — | `{ season_label, deadline }` | `{ notified }` |
| `seed-demo-data` | Creates demo users with predefined roles (development utility) | Manual invocation | — | — | `{ results[] }` |

---

## 7. Key shared hooks and utilities

| Hook/Utility | Responsibility | Used by |
|-------------|----------------|---------|
| `useAuth` (AuthProvider) | Session management, profile loading, role resolution (direct + group-derived), sign-out | Every authenticated component |
| `useModules` (ModulesProvider) | Loads modules, module_role_access, module_permissions, group memberships; computes `accessibleModules`; realtime subscription for permission changes | Sidebar, ProtectedRoute, admin panel |
| `useModuleAccess(route)` | Boolean check: can current user access a given route | `ProtectedRoute` |
| `useModulePermission(slug)` | Returns `{ canView, canEdit, canDelete, isOwner }` for a module slug | Admin sections, KB admin, news admin, etc. |
| `useAdminAccess` | Determines which admin panel sections the user can access; maps section IDs to module slugs | `ProtectedRoute`, `AppSidebar`, `Admin` page |
| `useNavSettings` (NavSettingsProvider) | Loads `org_chart_settings` key-value pairs; used for route disabling, theme defaults, IT config | `ProtectedRoute`, `AppLayout`, `Login` |
| `useDocuments` | Document folder/file CRUD operations with upload, rename, delete | `Documents` page |
| `ProtectedRoute` | Route guard: auth check → nav disabled check → admin special case → module access check | `App.tsx` (wraps all authenticated routes) |
| `LayoutRoute` | Wraps `AppLayout` (sidebar + main content) with `Suspense` for lazy-loaded pages | `App.tsx` |
| `src/lib/constants.ts` | Centralized constants: roles, order status config, app base URL, fallback IT email | Throughout codebase |
| `src/lib/emailTemplates.ts` | Branded HTML email template builder with SHF visual identity | Order notification emails |
| `src/lib/orderEmails.ts` | Order-specific email composition (approval requests, status changes) | Order creation/update flows |
| `src/lib/passwordCrypto.ts` | Client-side AES encryption/decryption for shared passwords | Passwords page |
| `src/lib/sendHelpdeskEmail.ts` | Helper to send helpdesk emails via send-email edge function | IT support page |
| `src/lib/moduleIcons.ts` | Maps icon string names to Lucide icon components | Sidebar, module displays |
| `src/lib/orgColors.ts` | Department color palette utilities | Org chart |
| `src/integrations/lovable/index.ts` | Lovable Cloud auth integration (Google OAuth) | Login page |

---

## 8. Integration points

| Integration | Purpose | Configuration |
|-------------|---------|---------------|
| **Google Workspace (OAuth)** | Primary SSO login via `lovable.auth.signInWithOAuth("google")` with `hd: "handelsfastigheter.se"` domain restriction | Configured via Lovable Cloud auth |
| **Resend** | Direct email sending (helpdesk, order notifications) | `RESEND_API_KEY` secret; sender: `noreply@it.handelsfastigheter.se` |
| **Lovable Email** | Queue-based transactional email (auth emails, batch notifications) via `@lovable.dev/email-js` | `LOVABLE_API_KEY` secret |
| **Lovable AI Gateway** | AI chat completions (SHF-Assistenten) | `LOVABLE_API_KEY` secret; model: `google/gemini-3-flash-preview` |
| **Firecrawl** | Web scraping for handelsfastigheter.se and allabolag.se → content_index | `FIRECRAWL_API_KEY` secret (managed connector) |
| **Cision** | RSS/XML press release feeds auto-imported to `news` table | Public URLs (no auth); RSS: `news.cision.com`; XML fallback: `publish.ne.cision.com` |
| **Splashtop** | Remote help tool link on login page | Configurable URL via `org_chart_settings` |
| **pgmq** | PostgreSQL message queue for email processing (auth_emails, transactional_emails queues + DLQs) | Database functions: `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq` |
| **pg_cron** | Scheduled jobs: Cision import (every 12h), scraping (nightly 02:00), notification cleanup, content sync, email queue processing | Managed via migrations |

---

## 9. Known complexity areas

### High complexity
1. **Permission resolution chain** (`useAuth` → `useModules` → `useModulePermission` → `useAdminAccess`): Four nested context providers with group-derived roles, module permissions, and admin section mapping. Race conditions are mitigated with fetch IDs but the chain is deep.
2. **Email queue system** (`process-email-queue/index.ts`): Retry logic with DLQ, TTL expiry, rate-limit backoff, duplicate detection, and visibility timeout management. Most complex edge function (~340 lines).
3. **Document folder access** (`has_folder_access` and `has_folder_write_access` DB functions): Role-based + module-permission-based access checks with recursive folder hierarchy.
4. **Content indexing ecosystem**: Dual indexing strategy — real-time triggers on 8+ tables AND batch sync via `sync-content-index` edge function. Must stay in sync.

### Medium complexity
5. **Order approval flow** (`NewOrder`, `OrderDetail`, `History`): Multi-status lifecycle (pending → approved/rejected → delivered) with email notifications, manager assignment, and RLS policies. No server-side state machine enforcement — status transitions are client-driven.
6. **Impersonation** (`impersonate-user/index.ts`, `ImpersonationBanner.tsx`): Generates real session tokens for another user; restricted to IT role but grants full access as that user.
7. **Planner drag-and-drop** (`KanbanColumn`, `KanbanCard`, `CardDetailDialog`): Uses `@dnd-kit` for card/column reordering with optimistic updates and activity logging.
8. **Password encryption** (`passwordCrypto.ts`, `get-passwords-key`): Client-side AES with server-held key. Key is returned to any authenticated user — access control is via `shared_password_groups` RLS.

### Sensitive areas
9. **RLS policy correctness**: Orders table allows `UPDATE` by approver but no column restrictions — approver could theoretically modify any order field. *(verify against source)*
10. **News auto-import deduplication**: Uses `source_url` matching — if Cision changes URLs, duplicates will occur.
11. **`org_chart_settings` as config store**: Used for nav toggling, theme defaults, IT remote help config, and more. No schema validation; any authenticated user can read all settings.

---

## 10. What this system is NOT

- **Not a public-facing website** — it is an internal-only intranet behind authentication. The public website is `handelsfastigheter.se` (separate system).
- **Not an ERP or accounting system** — it handles IT equipment ordering and approval workflows but does not manage invoicing, procurement, or financial transactions.
- **Not a property management system** — SHF uses external tools (Vitec, ViaEstate, Momentum, Metry) for property management; this system only links to them.
- **Not a messaging/chat platform** — the AI chat bubble is for assistant queries only, not inter-user messaging.
- **Not a mobile native app** — it is a responsive PWA (with `vite-plugin-pwa` installed) but not a native iOS/Android app.
- **Does not handle payroll, contracts, or legal documents** — HR features are limited to directory, celebrations, and recognitions.
- **Does not have multi-tenant support** — it serves a single organization (SHF/DG Gruppen).
- **Backend logic runs exclusively in Supabase Edge Functions (Deno)** — there is no separate API server, Node.js backend, or microservice architecture.
