## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.4.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for step-by-step workflow sequences and failure points
- Depends On: `core/DOMAIN_RULES.md`, `core/PERMISSION_MODEL.md`, `core/ARCHITECTURE.md`
- Used By: `core/AI_ANALYSIS.md`, `governance/KNOWN_RISKS.md`, `docs/MASTER_PROMPT.md`, `docs/AUTO_AUDIT_PROMPT.md`
- Owner: DG Gruppen
- Update Triggers: page flow changes, new module added, approval flow changes, email/notification changes, new admin flows, new edge functions

---

## Purpose

Maps all major business workflows of SHF Intra. Every analysis finding must be mapped to a workflow and a specific step.

This file owns workflow sequences and failure point identification. Business rules are owned by `core/DOMAIN_RULES.md` — referenced by section, not redefined here.

---

## Workflow template

Each workflow uses:
- **Trigger** — what initiates it
- **Actors** — who participates
- **Preconditions** — what must be true before it starts
- **Steps** — numbered sequence
- **Failure points** — where it can break
- **Backend guarantees** — VERIFIED / INFERRED / UNKNOWN
- **Linked domain invariants** — from `core/DOMAIN_RULES.md` §16

---

## Workflow 1 — Login and session resolution

**Trigger:** User navigates to `/login` and initiates sign-in.

**Actors:** User, `Login.tsx`, `useAuth.tsx`, Supabase Auth, Google OAuth.

**Preconditions:** User has a Google Workspace account at `handelsfastigheter.se`.

**Steps:**
1. User clicks "Sign in with Google"
2. Google OAuth initiated with `hd: "handelsfastigheter.se"` domain hint
3. Session established via Supabase Auth
4. Profile loaded from `profiles` table
5. Direct roles fetched from `user_roles`
6. Group-derived roles resolved via `group_members` + `groups.role_equivalent`
7. Roles merged into effective role set via `new Set()`
8. Access context derived; user redirected to `/dashboard`

**Failure points:**
- Domain restriction (`hd` hint) enforced only in `Login.tsx` — bypassable via direct OAuth flow
- `org_chart_settings` read pre-auth on login page — exposes internal config
- Role merge via `new Set()` may not preserve direct-role precedence
- Incomplete role set if profile or role fetch errors silently
- Stale auth state after token refresh or tab resume

**Backend guarantees:**
- Session validity: VERIFIED (Supabase Auth)
- Domain restriction server-side: UNKNOWN
- Role fetch completeness: INFERRED

**Linked domain invariants:** §16 Invariant 6 (roles in routing must reflect server-verified values).

---

## Workflow 2 — Route and module access

**Trigger:** User navigates to any authenticated route.

**Actors:** User, `ProtectedRoute.tsx`, `useModules.tsx`, `useNavSettings.tsx`, `useModulePermission.tsx`, `useAdminAccess.tsx`.

**Preconditions:** Active session; role set resolved (Workflow 1 complete).

**Steps:**
1. App shell loads
2. Modules and permissions loaded (`useModules.tsx`; Realtime channel on `module_permissions` opened)
3. Navigation settings loaded from `org_chart_settings` (`useNavSettings.tsx`)
4. `ProtectedRoute` evaluates: auth → nav disabled → admin special case → `useModuleAccess`
5. User allowed through or redirected

**Failure points:**
- Permission precedence ambiguity across four hooks with no shared invariant
- Route disabled in nav but still reachable via direct URL
- Slug drift between `useAdminAccess` section mappings and actual module slugs in DB
- Silent Realtime channel failure — module permission state becomes stale with no indication
- Frontend access decision not matched by backend enforcement

**Backend guarantees:**
- Route access enforcement: UNKNOWN (frontend-only)
- Module permission reads: VERIFIED (Supabase DB)
- Realtime reconnect strategy: UNKNOWN

**Linked domain invariants:** §16 Invariants 4, 5 (action authority depends on correct role resolution).

---

## Workflow 3 — New order creation

**Trigger:** User submits a new order in `NewOrder.tsx`.

**Actors:** Requester, `NewOrder.tsx`, `resolveApprovalRouting()`, Supabase DB, email Edge Function.

**Preconditions:** User is authenticated; at least one order item selected; approval routing computed.

**Steps:**
1. User opens `/orders/new`
2. Categories and order types loaded
3. Requester and recipient context resolved
4. `isPrivileged` checked if `recipient_type: "existing"` selected
5. `resolveApprovalRouting(...)` called — computes `approver_id` and auto-approve flag
6. `approver_id` resolved or auto-approve flag set
7. INSERT into `orders`
8. INSERT into `order_items`
9. INSERT notification for approver
10. Email sent to approver via Edge Function

**Failure points:**
- Steps 7–8 not wrapped in transaction — orphaned `orders` row on partial failure
- `resolveApprovalRouting()` runs in browser — `approver_id` can be forged
- `isPrivileged` check at Step 4 is frontend-only — bypassable
- Steps 9–10 are independent side effects — failure not surfaced consistently
- CEO escalation may fail silently if no CEO account exists
- Duplicate notifications/emails from retries or re-renders

**Backend guarantees:**
- Approval routing validation: UNKNOWN (frontend-only)
- Atomic order + items insert: UNKNOWN (no RPC confirmed)
- `isPrivileged` server-side: UNKNOWN
- Email delivery: INFERRED

**Linked domain invariants:** §16 Invariants 1, 2, 6.

---

## Workflow 4 — Order approval

**Trigger:** Assigned approver opens a pending order and approves it.

**Actors:** Approver (`approver_id`), `OrderDetail.tsx`, Supabase DB, email Edge Function.

**Preconditions:** Order in `pending` state; acting user is assigned `approver_id`.

**Steps:**
1. Approver opens order
2. Authority verified — only assigned `approver_id` may approve (frontend-only)
3. Status updated: `pending → approved`
4. Notification sent to requester
5. Email sent to requester

**Failure points:**
- Authority checked only in frontend; backend does not verify `auth.uid() = approver_id`
- Status update may be scoped only to `id` without checking current status is `pending`
- Optimistic UI update may mask backend failure
- Duplicate notification/email from retry or re-render

**Backend guarantees:**
- Approver identity enforcement: UNKNOWN
- Lifecycle predicate (`WHERE status = 'pending'`): UNKNOWN

**Linked domain invariants:** §16 Invariants 3, 4.

---

## Workflow 5 — Order rejection

**Trigger:** Assigned approver opens a pending order and rejects it.

**Actors:** Approver, `OrderDetail.tsx`, Supabase DB, email Edge Function.

**Preconditions:** Order in `pending` state; acting user is assigned `approver_id`.

**Steps:**
1. Approver opens pending order
2. Authority verified (frontend-only)
3. Status updated: `pending → rejected` (terminal)
4. Notification sent to requester
5. Rejection email sent

**Failure points:**
- Reject authority frontend-only
- Terminal state (`rejected`) may not be enforced server-side — could be overwritten via API
- Notification/email may drift from persisted state

**Backend guarantees:**
- Approver identity enforcement: UNKNOWN
- Terminal state enforcement: UNKNOWN

**Linked domain invariants:** §16 Invariants 3, 4.

---

## Workflow 6 — Order delivery

**Trigger:** Admin or IT user marks an approved order as delivered.

**Actors:** `admin`/`it` user, `OrderDetail.tsx`, Supabase DB, email Edge Function.

**Preconditions:** Order in `approved` state; acting user has `admin` or `it` role.

**Steps:**
1. Authorized user opens approved order
2. Delivery authority verified (frontend-only)
3. Status updated: `approved → delivered` (terminal)
4. Notification sent to requester
5. Delivery email sent

**Failure points:**
- Role gating frontend-only
- Invalid transition possible (e.g. `pending → delivered`) if status predicate is weak
- Terminal state may not be server-enforced

**Backend guarantees:**
- Role enforcement for delivery: UNKNOWN
- Terminal state enforcement: UNKNOWN
- Lifecycle predicate (`WHERE status = 'approved'`): UNKNOWN

**Linked domain invariants:** §16 Invariants 3, 5.

---

## Workflow 7 — Document upload and access

**Trigger:** User navigates to `/dokument` and uploads a file or accesses a folder.

**Actors:** User, `Documents.tsx`, `useDocuments` hook, Supabase DB, `documents` storage bucket.

**Preconditions:** User has module access to `documents`; target folder's `access_roles` includes user's role.

**Steps:**
1. User opens `/dokument`
2. Folder tree loaded; `has_folder_access()` evaluated per folder for visibility
3. User selects a folder
4. Files in folder loaded
5. User uploads a file:
   a. `has_folder_write_access()` checked
   b. File uploaded to `documents` storage bucket
   c. `document_files` row inserted with `folder_id` and `created_by`
6. User downloads/views a file:
   a. Storage URL generated
   b. File served from bucket

**Failure points:**
- Storage bucket URL may bypass folder-level access control if bucket RLS is not tied to `has_folder_access()`
- Recursive folder hierarchy — incorrect `has_folder_access()` traversal could expose nested content
- `created_by` must be set server-side — client-supplied value could be falsified
- Write permission check in Step 5a may be frontend-only if not mirrored in storage RLS

**Backend guarantees:**
- `has_folder_access()` DB function: INFERRED (exists per SYSTEM_OVERVIEW)
- Storage bucket RLS matching folder access_roles: UNKNOWN

**Linked domain invariants:** §16 Invariant 10 (files in restricted folders not reachable via direct URL).

---

## Workflow 8 — Password vault access

**Trigger:** User navigates to `/losenord` and views a shared password.

**Actors:** User, `Passwords.tsx`, `passwordCrypto.ts`, `get-passwords-key` edge function, Supabase DB.

**Preconditions:** User has module access to `losenord`; user belongs to a group in `shared_password_groups` for the target password.

**Steps:**
1. User opens `/losenord`
2. AES key fetched from `get-passwords-key` edge function
3. Passwords loaded — RLS on `shared_passwords` + `shared_password_groups` filters visible passwords
4. User clicks to reveal a password
5. `password_value` decrypted client-side using AES key
6. `password_access_log` row inserted (view event)
7. Decrypted value displayed temporarily

**Failure points:**
- `get-passwords-key` returns the same AES key to any authenticated user — key issuance not gated by group membership
- If RLS on `shared_passwords` has a gap, a user could retrieve encrypted values they should not see
- `password_access_log` write at Step 6 may not be enforced — if it fails silently, audit trail is broken
- AES key is exposed in browser memory during active session — XSS attack surface

**Backend guarantees:**
- Key authentication check: INFERRED (JWT required)
- Group membership check before key return: UNKNOWN
- RLS on `shared_passwords`: INFERRED
- `password_access_log` write enforcement: UNKNOWN

**Linked domain invariants:** §16 Invariants 7, 8.

---

## Workflow 9 — User impersonation

**Trigger:** IT or admin user initiates impersonation from admin panel.

**Actors:** IT/admin user, Admin panel, `impersonate-user` edge function, Supabase Auth.

**Preconditions:** Acting user has `it` or `admin` role; target user exists and is not the acting user.

**Steps:**
1. IT/admin opens admin panel → impersonation section
2. IT/admin selects target user
3. `impersonate-user` edge function called with `target_user_id`
4. Edge function verifies acting user's role (server-side — status INFERRED)
5. Supabase Admin API issues `access_token` + `refresh_token` for target user
6. Frontend stores tokens; session switches to target user
7. `ImpersonationBanner` displayed
8. IT/admin operates as target user with full permissions
9. IT/admin ends impersonation; original session restored

**Failure points:**
- If server-side role check at Step 4 is absent or bypassable, any authenticated user could impersonate anyone
- Self-impersonation guard may not exist
- `ImpersonationBanner` could theoretically be dismissed or hidden — must be persistent
- Impersonated session has full permissions — no read-only guard
- Audit logging of impersonation start/end may not be enforced

**Backend guarantees:**
- IT role check in edge function: INFERRED (not verified from inspected code)
- Self-impersonation guard: UNKNOWN
- Audit logging: UNKNOWN

**Linked domain invariants:** §16 Invariant 9 (impersonation verified server-side).

---

## Workflow 10 — Admin section access and mutation

**Trigger:** Admin/IT user enters admin panel and performs a management action.

**Actors:** Admin/IT user, `Admin.tsx`, `useAdminAccess.tsx`, Supabase DB.

**Preconditions:** User has `admin`/`it` role OR `can_edit` on the relevant module slug.

**Steps:**
1. User enters `/admin`
2. Section visibility resolved via `useAdminAccess` + module permission map
3. User selects a section (e.g. Users, Permissions, Settings)
4. Section content loaded from DB
5. User performs an admin action (create/update/delete)
6. Change persisted to DB

**Failure points:**
- Section visibility is UI-only — hidden sections reachable via API or direct URL
- Slug drift between `useAdminAccess` mappings and actual module slugs causes incorrect visibility
- Admin mutations at Step 6 may lack RLS backing — any authenticated user who reaches the endpoint could mutate
- `database-backup` edge function restricted to admin — server-side check status INFERRED

**Backend guarantees:**
- Section visibility enforcement: UNKNOWN (frontend-only)
- Admin mutation RLS: UNKNOWN (varies by table)
- `database-backup` admin check: INFERRED

**Linked domain invariants:** §16 Invariants 4, 5.

---

## Workflow 11 — Email queue processing

**Trigger:** pg_cron schedule fires; OR auth event enqueues an email.

**Actors:** pg_cron, `process-email-queue` edge function, pgmq, Lovable Email API, `email_send_log`, DLQ.

**Preconditions:** pgmq queues (`auth_emails`, `transactional_emails`) contain messages.

**Steps:**
1. pg_cron fires `process-email-queue`
2. Edge function reads batch from pgmq queue (visibility timeout applied)
3. TTL check — expired messages moved to DLQ
4. Duplicate detection — messages already processed skipped
5. Rate limit state checked (`email_send_state`)
6. Email sent via Lovable Email API
7. `email_send_log` row inserted with outcome
8. Message deleted from queue on success; retry count incremented on failure
9. After max retries, message moved to DLQ (`move_to_dlq`)

**Failure points:**
- DLQ accumulation has no alerting — silent failure accumulation possible
- If pg_cron job fails to fire, queue backs up with no notification
- Rate limit bypass not prevented at DB level — only in edge function
- Visibility timeout expiry before processing complete causes duplicate processing
- `email_send_log` write failure loses audit trail

**Backend guarantees:**
- pgmq queue operations: VERIFIED (pgmq is server-side)
- pg_cron scheduling: VERIFIED
- DLQ alerting: UNKNOWN (not confirmed)

**Linked domain invariants:** §16 Invariants 11, 12.

---

## Workflow 12 — Content indexing and AI assistant query

**Trigger — indexing:** DB trigger on source table change; OR pg_cron nightly batch; OR admin-initiated sync.

**Trigger — query:** User sends message to AI chat bubble.

**Actors (indexing):** DB triggers, `sync-content-index` edge function, `scrape-website`, `scrape-allabolag`, `fetch-cision-feed`.
**Actors (query):** User, `AiChatBubble.tsx`, `ai-chat` edge function, `content_index`, Lovable AI Gateway.

**Preconditions (indexing):** Source tables contain publishable content.
**Preconditions (query):** User is authenticated; `content_index` is populated.

**Indexing steps:**
1. Content created/updated in source table (news, kb_articles, etc.)
2. DB trigger fires → `content_index` row updated/inserted
3. OR: pg_cron fires `sync-content-index` → full re-index
4. OR: pg_cron fires `scrape-website`/`scrape-allabolag` → external content indexed

**Query steps:**
1. User sends message in AI chat
2. `ai-chat` edge function performs full-text search on `content_index`
3. Relevant content passed as context to Lovable AI Gateway
4. AI generates response; SSE stream returned to client
5. Response displayed in chat bubble

**Failure points:**
- Dual indexing paths (trigger + batch) can diverge — AI answers from inconsistent data
- Unpublished or access-restricted content may be indexed and retrievable by any authenticated user
- Scraped external content may include PII without explicit intent
- Nightly scraping jobs that fail silently leave external content stale
- No per-user access filtering in `ai-chat` confirmed — all indexed content may be retrievable

**Backend guarantees:**
- DB triggers for real-time indexing: INFERRED
- Batch sync correctness: INFERRED
- Access filtering in `ai-chat`: UNKNOWN

**Linked domain invariants:** §16 (no direct invariant; §15 content indexing rules apply).

---

## Workflow 13 — Notification and email side effects

**Trigger:** Any order lifecycle event (creation, approval, rejection, delivery).

**Actors:** `NewOrder.tsx` or `OrderDetail.tsx`, Supabase DB (notifications table), email edge function.

**Preconditions:** A confirmed state transition has occurred.

**Steps:**
1. Order lifecycle event confirmed
2. `notifications` row inserted for relevant recipient (per `core/DOMAIN_RULES.md` §7)
3. Email invoked via `supabase.functions.invoke("send-email")` or enqueued via pgmq

**Failure points:**
- `send-email` called without error handling or retry — silent failure on network error
- Notifications not idempotency-protected — re-renders or retries can duplicate
- Notification insert and email send are independent — one can succeed while the other fails

**Backend guarantees:**
- Email delivery confirmation: UNKNOWN (direct send path)
- Notification idempotency: UNKNOWN

**Linked domain invariants:** §16 Invariants 11, 12; `core/DOMAIN_RULES.md` §7–§8.

---

## Workflow 14 — Workwear ordering

**Trigger:** User navigates to `/arbetsklader` and submits a workwear order.

**Actors:** User, `Workwear.tsx`, Supabase DB (`workwear_orders`), admin notification.

**Preconditions:** User authenticated; active workwear season configured by admin.

**Steps:**
1. User opens `/arbetsklader`
2. Available workwear items loaded (season-specific catalog)
3. User selects items and submits
4. `workwear_orders` row inserted with `user_id`, `items` (JSON), `notes`, `status`
5. Admin notified (via `notify-workwear-season` edge function or notification insert)

**Failure points:**
- `items` stored as JSON — no line-item table; schema changes require JSON migration
- Admin notification on submission may not be implemented (status INFERRED)
- No order lifecycle defined for workwear beyond `status` field — transition rules unclear

**Backend guarantees:**
- Order insert: INFERRED
- Admin notification: INFERRED

**Linked domain invariants:** No order invariants apply directly; general data integrity rules apply.
