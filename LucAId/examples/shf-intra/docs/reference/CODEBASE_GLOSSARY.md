## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.4.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for canonical term definitions across the full system
- Depends On: `core/DOMAIN_RULES.md`, `core/PERMISSION_MODEL.md`
- Used By: All docs files, analysis tools
- Owner: DG Gruppen
- Update Triggers: new roles, new modules, new tables, new permission concepts, new integrations, terminology changes

---

## Purpose

Defines project-specific terminology for SHF Intra. Use glossary definitions before inferring meaning from code. If code uses a term differently, state both meanings and whether they match.

---

## System terms

### SHF Intra
The internal intranet platform for Svenska Handelsfastigheter (SHF). Live at `https://intra.handelsfastigheter.se`. Built on React + Supabase (Lovable Cloud).

### Svenska Handelsfastigheter (SHF)
Swedish commercial real estate company. The owner and sole tenant of SHF Intra.

### DG Gruppen
The development organization maintaining `handelsfastigheter-order-flow`. The repository owner.

---

## Role terms

### admin
High-privilege role. Full CRUD on all tables; all admin sections; database backup; user management; module configuration.

### it
IT support role. Equivalent to admin for admin panel access. Can impersonate users. Manages IT FAQ, passwords, helpdesk.

### manager
Department manager role. Can approve/reject orders assigned to them. Views subordinate orders.

### staff
Staff-level employee. Extended access beyond base employee (e.g. org chart visibility).

### employee
Standard employee. Base access: create orders, view own orders, access permitted modules.

### CEO
Treated as auto-approver in the order system. Orders by CEO role auto-approve. May be the escalation target for manager/admin orders requiring CEO approval.

### direct role
A role assigned explicitly via `user_roles` table. Takes precedence over group-derived roles.

### group-derived role
A role inherited from group membership (`group_members` + `groups.role_equivalent`). Lower precedence than direct roles.

---

## Order and workflow terms

### requester
The authenticated user who creates an order. Stored as `requester_id` on the `orders` row.

### recipient
The person the order is intended for. Not always the requester. Stored as `recipient_name` and `recipient_type`.

### recipient_type
Classification of the order recipient. `"existing"` means the order is for another user (requires `isPrivileged`). Default is self.

### approver
The user responsible for approving or rejecting an order. Determined by `resolveApprovalRouting(...)`. Stored as `approver_id`.

### approver_id
The user id of the assigned approver on an order. Must be non-null for all non-auto-approved orders.

### auto-approve
An order path where no external approver is required. Applies to CEO orders and to staff/IT/employee with no resolvable manager.

### isPrivileged
A flag indicating elevated ordering rights — currently manager and admin roles. Required to use `recipient_type: "existing"`. **Currently enforced frontend-only.**

### order lifecycle
`pending → approved → delivered` or `pending → rejected`. See `core/DOMAIN_RULES.md` §3.

### delivery
Final step: approved order marked as delivered. Only `admin` or `it` may perform this.

---

## Permission and access terms

### module
A functional area of SHF Intra controlled by access rules. Registered in the `modules` table with a slug, route, icon, and active flag.

### module slug
The string identifier for a module (e.g. `"new-order"`, `"losenord"`, `"planner"`). Used as the key for permission lookups and admin section mappings. **Slug drift** — where slug used in code differs from slug in DB — causes incorrect access behavior.

### module_role_access
Role-based module access rules. Grants access to a module based on role. Lower precedence than `module_permissions`.

### module_permissions
Explicit user- or group-level module permissions. Fields: `can_view`, `can_edit`, `can_delete`, `is_owner`. Higher precedence than `module_role_access`.

### can_view
Permission to see/access a module. Does not imply edit or delete authority.

### can_edit
Permission to create/update content within a module. Required for admin section actions in many modules.

### can_delete
Permission to delete content within a module.

### is_owner
Full ownership rights over a module. Highest module-level permission.

### route disablement
Frontend hiding of a route via `org_chart_settings`. Does not prevent direct URL access.

### admin section
A subsection within `/admin`. Mapped to a module slug via `useAdminAccess`. Slug drift causes incorrect visibility.

### frontend enforcement
Access logic in `src/**`. Not trusted as final authorization.

### backend enforcement
Policies in `supabase/migrations/**`, `supabase/functions/**`, or RLS. Trusted as final authorization.

---

## Document module terms

### document_folders
Table defining the folder hierarchy. Each folder has `access_roles` (view) and `write_roles` (upload/modify).

### access_roles
Array of role strings on a `document_folders` row. Defines which roles can view folder contents.

### write_roles
Array of role strings on a `document_folders` row. Defines which roles can upload or modify files.

### has_folder_access
DB function that evaluates whether a user can view a given folder based on `access_roles`.

### has_folder_write_access
DB function that evaluates whether a user can write to a given folder based on `write_roles`.

---

## Password vault terms

### shared_passwords
Table storing encrypted shared credentials. `password_value` is AES-encrypted client-side.

### shared_password_groups
Join table linking passwords to groups. RLS on `shared_passwords` uses this to filter visible passwords.

### password_access_log
Audit log for every password view event. Writing to this table on every view is a system invariant.

### get-passwords-key
Edge function that returns the AES encryption key. Currently returns to any authenticated user — key issuance not gated by group membership.

### passwordCrypto.ts
Client-side AES encryption/decryption library. Uses the key from `get-passwords-key`.

---

## Content and AI terms

### content_index
Unified full-text search index table. Aggregates news, KB articles, KB videos, document files, CEO blog, and scraped web content. Used by `ai-chat` edge function.

### ai-chat
Edge function powering SHF-Assistenten (the AI chat bubble). Queries `content_index`, passes results to Lovable AI Gateway (Gemini), streams response to client.

### SHF-Assistenten
The AI assistant accessible via the chat bubble in the app layout. Powered by `ai-chat` edge function.

### sync-content-index
Edge function that performs a full re-index of all content sources into `content_index`.

---

## Email system terms

### send-email
Edge function for direct email sending via Resend API. Called from frontend. No queue.

### process-email-queue
Edge function that processes pgmq email queues on pg_cron schedule. Handles retry, DLQ, rate limiting.

### pgmq
PostgreSQL message queue extension. Used for auth emails and transactional notification emails.

### DLQ (dead-letter queue)
Where messages go after max retry exhaustion. Requires monitoring — silent accumulation is a known risk.

### email_send_log
Table recording every email send attempt and outcome. Writing here on every send is a system invariant.

### suppressed_emails
Table of email addresses that must never receive transactional email. Checked before every send.

---

## Impersonation terms

### impersonate-user
Edge function that generates a real Supabase session (`access_token` + `refresh_token`) for a target user. Restricted to `it` and `admin` roles.

### ImpersonationBanner
UI component displayed during an impersonated session. Must always be visible; must not be dismissible.

---

## Integration terms

### Resend
External email service used for direct email sends (`send-email` edge function).

### Lovable Email
Queue-based email service used for auth and transactional emails via pgmq.

### Lovable AI Gateway
AI completion service used by `ai-chat`. Current model: `google/gemini-3-flash-preview`.

### Firecrawl
Web scraping service used by `scrape-website` and `scrape-allabolag` edge functions.

### Cision
Press release syndication service. `fetch-cision-feed` imports releases to `news` table every 12 hours.

### org_chart_settings
Key-value configuration table used for nav route toggling, theme defaults, IT remote help URL, and other system settings. Read partially pre-auth on login page.

---

## Analysis meta-terms

### conditional security risk
A plausible risk where backend protection has not been verified. May or may not be exploitable.

### design gap
A structural weakness that creates risk even without a confirmed exploit.

### workflow drift
A state where intended workflow sequence and actual implementation have diverged.

### slug drift
A state where the module slug used in frontend code differs from the slug stored in the database, causing permission checks to fail silently or expose incorrect sections.
