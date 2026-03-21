## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.4.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for all business rules, module behavior, and system invariants
- Depends On: —
- Used By: All docs files, analysis tools
- Owner: DG Gruppen
- Update Triggers: any module rule changes, new module added, role changes, lifecycle changes, backend guarantees implemented

---

## Authoritative intent

This file defines the intended business rules for SHF Intra across all modules. When code diverges from these rules, the code is wrong — not this document.

All other files that reference rules defined here must link to the relevant section rather than redefine the rule. See `governance/DOC_OWNERSHIP_RULES.md`.

---

## Section 1 — System overview

SHF Intra is the internal intranet for Svenska Handelsfastigheter (SHF). It serves all employees (~50–200 users) and provides:

- IT equipment ordering and approval
- Knowledge management (articles, videos)
- Internal news and press releases
- Document storage
- Project planning (Kanban)
- HR and culture features (recognitions, celebrations, directory)
- Shared password vault
- IT support and helpdesk
- External tool links
- Workwear ordering
- AI-powered assistant
- Admin panel for system management

It is not a public-facing website, ERP, property management system, messaging platform, or multi-tenant SaaS.

---

## Section 2 — Roles

| Role | Description | Key permissions |
|---|---|---|
| `admin` | System administrators | Full CRUD on all tables; all admin sections; database backup; user management; module configuration; impersonation (via IT) |
| `it` | IT support staff | Equivalent to admin for admin panel; can impersonate users; manages IT FAQ, passwords, helpdesk |
| `manager` | Department managers | Can approve/reject orders assigned to them; view subordinate orders; standard module access |
| `staff` | Staff-level employees | Extended access beyond base employee (e.g. org chart visibility) |
| `employee` | Standard employees | Base access: create orders, view own orders, access permitted modules |

**Role assignment:** Roles are stored in `user_roles` (direct) or derived from `groups.role_equivalent` via `group_members` (group-derived). Direct roles take precedence over group-derived roles.

**Permission resolution order (module access):**
1. Explicit `module_permissions` entry for the user
2. Explicit `module_permissions` entry for the user's group
3. `module_role_access` rule for the user's role
4. Default: no rules = accessible to all authenticated users

---

## Section 3 — Order lifecycle

### States

| State | Terminal | Description |
|---|---|---|
| `pending` | No | Awaiting approver action |
| `approved` | No | Approved; awaiting delivery |
| `rejected` | Yes | Declined by approver |
| `delivered` | Yes | Fulfilled by admin or IT |

### Permitted transitions
```
pending → approved
pending → rejected
approved → delivered
```

Any other transition is invalid and must be blocked at both UI and backend level. Terminal states (`rejected`, `delivered`) are irreversible.

---

## Section 4 — Approval routing

All approval routing is determined by `resolveApprovalRouting(...)` in `NewOrder.tsx`. **This function currently runs in the browser — a known critical risk.**

### Routing decision matrix

| Requester role | Condition | Outcome |
|---|---|---|
| CEO | Always | Auto-approve |
| Manager / Admin | Order type requires CEO | Escalate to CEO |
| Manager / Admin | Order type allows self-approve | Auto-approve |
| Manager / Admin | Otherwise | Route to manager |
| Staff / IT / Employee | No manager resolvable | Auto-approve |
| Staff / IT / Employee | Manager exists | Route to manager |

This matrix is authoritative. Any refactoring of `resolveApprovalRouting(...)` must preserve all rows exactly.

### Edge cases
- Multiple managers in group: resolution must be deterministic (currently undefined — flagged as risk)
- CEO approval when no CEO account exists: must fail gracefully, not silently auto-approve
- Every non-auto-approved order must have a resolved `approver_id` before insertion

---

## Section 5 — Order creation rules

An order is only valid if it has:
- At least one `order_item`
- A `requester_id`
- A resolved `approver_id` (or explicit auto-approve flag)

**Intended creation flow:**
1. Insert into `orders`
2. Insert into `order_items`
3. Insert notification for approver
4. Send email to approver via Edge Function

Steps 1 and 2 must be atomic. Steps 3 and 4 are side effects — failure must be surfaced, not silently swallowed.

**Recipient rules:**

| Recipient type | Permitted for |
|---|---|
| Self (default) | Any authenticated user |
| `existing` (another user) | Users with `isPrivileged` status (manager, admin) |

`isPrivileged` check currently lives only in `NewOrder.tsx` — not server-enforced.

---

## Section 6 — Order action authorization

| Action | Permitted |
|---|---|
| Create order | Any authenticated user |
| Approve order | Assigned `approver_id` only |
| Reject order | Assigned `approver_id` only |
| Deliver order | `admin`, `it` |
| View all orders | `admin`, `it` |
| View own orders | Any authenticated user |

A manager who is not the assigned `approver_id` must not be able to approve, even with a manager role.

---

## Section 7 — Notifications

| Event | Recipient |
|---|---|
| Order created | `approver_id` |
| Order approved | Requester |
| Order rejected | Requester |
| Order delivered | Requester |

Each event must trigger exactly one notification. Duplicate notifications from re-renders, retries, or auth refreshes must be guarded against.

---

## Section 8 — Email rules

Emails are sent for the same events as notifications (§7) via Supabase Edge Functions using Resend or Lovable Email (pgmq queue).

- Email and notification delivery are independent side effects
- Failure in one must not silently suppress the other
- Neither failure must silently pass as a successful order action
- `email_send_log` must record every send attempt and outcome

---

## Section 9 — Knowledge base rules

- Published articles and videos are accessible to all authenticated users
- Unpublished content is visible only to editors and admins
- Editors can create, update, and delete KB content — determined by `can_edit` on the `kunskapsbanken` module permission
- `views` counter increments on view — must not be writable by non-editors directly

---

## Section 10 — Document module rules

- Documents are organized in a folder hierarchy (`document_folders`)
- Each folder has `access_roles` (who can view) and `write_roles` (who can upload/modify)
- Access is evaluated recursively up the folder hierarchy — a user with access to a parent folder does not automatically have access to a child folder unless the child also grants access
- File upload is permitted only to users whose role appears in the folder's `write_roles`
- Files must not be accessible via storage bucket URL if the folder restricts access — RLS must cover storage paths
- Folder and file deletion requires write permission on the folder
- `created_by` is set to the authenticated user at upload time and must not be overridable by the client

---

## Section 11 — Password vault rules

- Shared passwords are stored encrypted using AES client-side (`passwordCrypto.ts`)
- The AES encryption key is retrieved from `get-passwords-key` edge function — returned to any authenticated user
- Access control for passwords is enforced exclusively via `shared_password_groups` RLS — a user may only see passwords where their group is in `shared_password_groups`
- Every password view must be logged to `password_access_log` — this is an audit requirement
- Passwords may only be created, edited, or deleted by users with `can_edit` on the `losenord` module (or admin/IT)
- The key endpoint must not return the key to unauthenticated requests

---

## Section 12 — Planner rules

- Any authenticated user with module access can view boards
- Board creation, column management, and card management require `can_edit` on the `planner` module
- Cards can be assigned to any user in the system
- Drag-and-drop reordering must persist to the database — optimistic updates must be rolled back on failure
- All significant board actions must be logged to `planner_activity_log`
- Attachments are stored in Supabase Storage — access must be gated by board access, not open bucket reads

---

## Section 13 — Email queue rules

SHF Intra uses two email channels:

**Direct (Resend via `send-email` edge function):** Used for helpdesk emails and simple notifications. Called directly from frontend.

**Queue-based (pgmq via `process-email-queue`):** Used for auth emails and bulk transactional notifications. Processed by pg_cron. Has retry logic, DLQ, rate limiting, and TTL expiry.

Rules:
- Every email sent via the queue must produce an entry in `email_send_log`
- Suppressed emails (`suppressed_emails` table) must never receive transactional email
- DLQ accumulation must be surfaced — silent DLQ growth is a High risk
- Rate limit state in `email_send_state` must be respected; bypass is not permitted
- Unsubscribe tokens (`email_unsubscribe_tokens`) must be single-use

---

## Section 14 — Impersonation rules

- Impersonation is available to `it` and `admin` roles only
- `impersonate-user` edge function must verify the requesting user's role server-side before issuing tokens
- A user must not be able to impersonate themselves
- An impersonated session must display the `ImpersonationBanner` at all times — the banner must not be dismissible
- Impersonation must be logged (audit trail)
- Impersonated sessions should be time-limited or explicitly terminated

---

## Section 15 — Content indexing rules

`content_index` is the unified search index used by the AI assistant (`ai-chat` edge function).

- Content is indexed from: news, kb_articles, kb_videos, document_files, ceo_blog, and scraped web content
- Two indexing paths exist: real-time triggers (on content table changes) and batch sync (`sync-content-index` edge function)
- Both paths must stay consistent — divergence means the AI assistant answers from stale or incomplete data
- Unpublished or access-restricted content must not be indexed in a way that makes it retrievable via the AI assistant without access checks
- Scraped content from external sources must not index PII without explicit intent

---

## Section 16 — System invariants

These conditions must always be true. Any violation is a bug regardless of how it occurred.

1. Every `orders` row has at least one corresponding `order_items` row.
2. Every non-auto-approved order has a non-null `approver_id` referencing a valid user.
3. Order status always follows the permitted transition graph (§3).
4. Only the assigned `approver_id` may approve or reject a given order.
5. Only `admin` or `it` roles may transition an order to `delivered`.
6. Roles used in approval routing reflect server-verified values, not client-computed ones.
7. Every password view is logged to `password_access_log`.
8. The AES password key is never returned to an unauthenticated request.
9. Impersonation is only possible for users with `it` or `admin` role — verified server-side.
10. Document files in access-restricted folders are not reachable via direct storage URL.
11. Every email send attempt is recorded in `email_send_log`.
12. Suppressed email addresses never receive transactional email.

---

## Section 17 — Known security risks (summary)

Full entries in `governance/KNOWN_RISKS.md`. This table is a pointer only.

| Risk | Severity |
|---|---|
| Frontend approval routing | Critical |
| Admin/IT UI gating only | High |
| Domain restriction client-side | High |
| Multi-step order write without transaction | High |
| Approver ID not verified server-side | High |
| Recipient privilege not server-enforced | High |
| Password key returned to all authenticated users | High |
| Document storage bucket URL bypass (unverified) | High |
| Impersonation server-side role check (unverified) | High |
| `org_chart_settings` readable by all authenticated users pre-auth | Medium |
| Role merge precedence unverified | Medium |
| Realtime channel silent failure | Medium |
| Content index staleness | Medium |
| Email DLQ silent accumulation | Medium |

---

## Section 18 — Required backend guarantees (target state)

When any of these is implemented, update `governance/KNOWN_RISKS.md` and §17 above.

- Approve/reject: verify `auth.uid() = approver_id` and `status = 'pending'` at DB level
- Deliver: verify `admin` or `it` role and `status = 'approved'` at DB level
- Order insert: atomic RPC for `orders` + `order_items`
- `isPrivileged` for `recipient_type: "existing"`: verify server-side
- Domain restriction: enforce at Edge Function or auth hook level
- Admin writes: RLS restricting sensitive table writes to admin role
- Impersonation: server-side IT role check before token issuance (verify current status)
- Document storage: RLS on storage bucket paths matching folder `access_roles`
- Password key: verify group membership before returning key from `get-passwords-key`
- Content index: exclude unpublished and access-restricted content from AI-retrievable index
