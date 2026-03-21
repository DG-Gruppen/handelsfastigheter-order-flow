## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.7.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for workflow step sequences, failure points, and smoke tests
- Depends On: `docs/core/DOMAIN_RULES.md`, `docs/core/PERMISSION_MODEL.md`, `docs/core/ARCHITECTURE.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `docs/governance/KNOWN_RISKS.md`
- Owner: DG Gruppen
- Update Triggers: workflow step change, approval flow change, new workflow added

---

## Purpose

This file maps the step-by-step execution of every major workflow. Use it to:
- Map analysis findings to specific workflow steps
- Identify where failures propagate
- Verify that domain rules are enforced at the right steps

**See also:**
- `docs/core/DOMAIN_RULES.md` — the rules each workflow must enforce
- `docs/core/PERMISSION_MODEL.md` — access checks at each step

---

## Workflows

### WF-1: Standard order creation

**Trigger:** User clicks "Ny beställning" and submits form
**Actor:** Any authenticated user
**Preconditions:** User is logged in; has a profile with `manager_id` set (or is VD/STAB/IT)

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | User fills order form (type, items, description) | Requester | Client validation | Form prevents submit if required fields missing |
| 2 | Client resolves approver from `profiles.manager_id` | Client | Client-side lookup | If no manager → auto-approve path |
| 3 | INSERT into `orders` with `status: pending` | Client | RLS (authenticated INSERT) | DB error on constraint violation |
| 4 | INSERT order items into `order_items` | Client | RLS | — |
| 5 | Enqueue approval notification email via pgmq | Client | RPC `enqueue_email()` | Silent failure if queue unavailable |
| 6 | Create in-app notification for approver | Client | RPC `create_notification()` | Silent failure |

**Postconditions:** Order exists with `status: pending`, approver assigned, email queued.

**Smoke tests:**
- ST-1.1: Create order as employee with manager → order is pending, manager receives email
- ST-1.2: Create order as user without manager → order auto-approved
- ST-1.3: Create order with missing required fields → form prevents submission

---

### WF-2: Order approval

**Trigger:** Manager opens order detail and clicks "Godkänn"
**Actor:** Assigned approver (manager) or admin
**Preconditions:** Order `status = pending`, actor is `orders.approver_id` or has admin role

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | Load order detail | Approver | RLS SELECT | — |
| 2 | Verify actor is approver or admin | Client | **Client-side check only** | Any authenticated user could UPDATE via API |
| 3 | UPDATE `orders.status` → `approved`, set `approved_at` | Approver | RLS (authenticated UPDATE) | No server-side approver verification |
| 4 | Enqueue approval confirmation email | Client | RPC `enqueue_email()` | Silent failure |
| 5 | Create notification for requester | Client | RPC `create_notification()` | Silent failure |

**Postconditions:** Order `status = approved`, requester notified.

**Smoke tests:**
- ST-2.1: Approver approves pending order → status changes to approved, requester notified
- ST-2.2: Non-approver attempts to approve → UI blocks action (but API would allow it)
- ST-2.3: Attempt to approve non-pending order → UI blocks; no server-side check

---

### WF-3: Order rejection

**Trigger:** Manager opens order detail and clicks "Avvisa"
**Actor:** Assigned approver or admin
**Preconditions:** Order `status = pending`, actor is approver or admin

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | Approver enters rejection reason | Approver | Client validation (required) | UI prevents empty reason |
| 2 | UPDATE `orders.status` → `rejected`, set `rejection_reason` | Approver | RLS (authenticated UPDATE) | No server-side approver check |
| 3 | Enqueue rejection notification email | Client | RPC `enqueue_email()` | Silent failure |
| 4 | Create notification for requester | Client | RPC `create_notification()` | — |

**Postconditions:** Order `status = rejected` with reason, requester notified.

**Smoke tests:**
- ST-3.1: Reject with reason → status rejected, reason saved, requester notified
- ST-3.2: Reject without reason → UI prevents submission

---

### WF-4: Order delivery

**Trigger:** Admin marks approved order as delivered
**Actor:** Admin only
**Preconditions:** Order `status = approved`

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | Admin clicks "Levererad" with optional comment | Admin | Client-side admin check | Non-admin UI hides button |
| 2 | UPDATE `orders.status` → `delivered`, set `delivery_comment` | Admin | RLS (authenticated UPDATE) | No server-side admin check for delivery |
| 3 | Enqueue delivery notification | Client | RPC | Silent failure |

**Postconditions:** Order `status = delivered`, requester notified.

**Smoke tests:**
- ST-4.1: Admin delivers approved order → status delivered
- ST-4.2: Non-admin cannot see delivery button

---

### WF-5: Onboarding order

**Trigger:** User submits onboarding form
**Actor:** Any authenticated user (typically manager or HR)
**Preconditions:** User logged in

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | Fill onboarding form with recipient details | Requester | Client validation | — |
| 2 | Create placeholder profile (`is_hidden: true`) | Client | INSERT into `profiles` | Unique constraint on email could fail |
| 3 | Create order with `recipient_*` fields | Client | RLS INSERT | — |
| 4 | Auto-approve if requester is VD/STAB/IT/manager-without-superior | Client | **Client-side logic** | Auto-approval decision is not server-enforced |
| 5 | When new user logs in → `handle_new_user()` trigger links to placeholder | DB trigger | Database (SECURITY DEFINER) | If email mismatch, no linking occurs |

**Postconditions:** Order created; placeholder profile exists; will link on first login.

**Smoke tests:**
- ST-5.1: Manager creates onboarding → order pending, placeholder created
- ST-5.2: IT creates onboarding → order auto-approved
- ST-5.3: New employee logs in → profile linked via trigger

---

### WF-6: Password access

**Trigger:** User navigates to password vault
**Actor:** Any authenticated user
**Preconditions:** User belongs to at least one group linked to passwords

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | Client calls `get-passwords-key` Edge Function | Client | JWT verification only | Key returned to ALL authenticated users |
| 2 | Client queries `shared_passwords` | Client | RLS: `has_shared_password_access()` | Only passwords in user's groups returned |
| 3 | Client decrypts passwords with AES key | Client | Client-side | — |
| 4 | Password view/copy logged to `password_access_log` | Client | RLS INSERT | Silent failure if INSERT fails |

**Postconditions:** User sees only passwords accessible via their groups; access logged.

**Smoke tests:**
- ST-6.1: User in group A sees only group A passwords
- ST-6.2: User in no groups sees no passwords (but still receives AES key)
- ST-6.3: View/copy action creates access log entry

---

### WF-7: Impersonation

**Trigger:** IT/admin selects user to impersonate
**Actor:** IT or admin role
**Preconditions:** Actor has IT or admin role (verified server-side)

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | Select target user from user list | IT/Admin | Client-side filter | — |
| 2 | Call `impersonate-user` Edge Function | Client | Edge Function: verifies IT/admin role | Returns 403 if not IT/admin |
| 3 | Edge Function generates session token for target | Edge Function | Service role key | — |
| 4 | Client stores impersonated session | Client | — | — |
| 5 | `ImpersonationBanner` shown | Client | Component always renders during impersonation | — |

**Postconditions:** Actor operates as target user; banner visible; original session recoverable.

**Smoke tests:**
- ST-7.1: IT user impersonates employee → session switches, banner visible
- ST-7.2: Employee attempts impersonation → Edge Function returns 403
- ST-7.3: Impersonation banner cannot be dismissed

---

### WF-8: Cision news import

**Trigger:** pg_cron schedule (every 12 hours)
**Actor:** System (automated)
**Preconditions:** `fetch-cision-feed` function deployed with `verify_jwt = false`

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | pg_cron invokes `fetch-cision-feed` via HTTP | System | No JWT (cron) | Function unreachable → no import |
| 2 | Function fetches Cision RSS feed | Edge Function | HTTP GET | Feed unavailable → function exits gracefully |
| 3 | Parse RSS entries | Edge Function | — | Malformed XML → skip entry |
| 4 | Deduplicate by `source_url` | Edge Function | SELECT existing `source_url` values | — |
| 5 | INSERT new articles with `source: 'cision'`, `is_published: true` | Edge Function | Service role key (bypasses RLS) | — |

**Postconditions:** New Cision articles appear in news feed; duplicates skipped.

**Smoke tests:**
- ST-8.1: New Cision article appears after cron run
- ST-8.2: Existing article is not duplicated
- ST-8.3: RSS feed failure does not crash function

---

### WF-9: Email processing

**Trigger:** pg_cron schedule
**Actor:** System (automated)
**Preconditions:** pgmq queues exist; `email_send_state` configured

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | `process-email-queue` reads batch from pgmq | Edge Function | `read_email_batch()` RPC | Empty queue → no-op |
| 2 | Check `suppressed_emails` for each recipient | Edge Function | SELECT | — |
| 3 | Check rate limit in `email_send_state.retry_after_until` | Edge Function | — | If rate-limited → skip batch |
| 4 | Call `send-email` Edge Function for each email | Edge Function | Service role | Resend API failure → retry or DLQ |
| 5 | On success: delete from queue, log to `email_send_log` | Edge Function | `delete_email()` RPC | — |
| 6 | On failure: increment retry; move to DLQ after max retries | Edge Function | `move_to_dlq()` RPC | — |

**Postconditions:** Emails sent; failures in DLQ; log updated.

**Smoke tests:**
- ST-9.1: Queued email is sent and logged
- ST-9.2: Suppressed email is skipped
- ST-9.3: Failed email moves to DLQ after max retries

---

### WF-10: Document upload

**Trigger:** User uploads file to a folder
**Actor:** Any user with write access to the target folder
**Preconditions:** User has role matching folder's `write_roles`, or is admin

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | User selects folder and file | Uploader | Client-side filter (folders with write access) | — |
| 2 | Upload file to Supabase Storage bucket `documents` | Client | Storage bucket policies | Policy mismatch → upload denied |
| 3 | INSERT metadata into `document_files` | Client | RLS: `has_folder_write_access()` | — |
| 4 | Trigger indexes file in `content_index` | DB trigger | — | Silent failure |
| 5 | Trigger creates notification for folder watchers | DB trigger | — | Silent failure |

**Postconditions:** File stored; metadata saved; indexed; notifications sent.

**Smoke tests:**
- ST-10.1: User with write access uploads file → success
- ST-10.2: User without write access → upload denied
- ST-10.3: File appears in content search after upload

---

### WF-11: Planner card lifecycle

**Trigger:** User creates or moves a card
**Actor:** Any authenticated user
**Preconditions:** Board exists and is not archived

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | Create card with title, column, priority | Creator | RLS INSERT | — |
| 2 | Assign card to user (optional) | Creator/Editor | Client + RLS UPDATE | Assignment notification triggered |
| 3 | Drag card to new column | Any user | dnd-kit + UPDATE `column_id`, `sort_order` | Optimistic UI; revert on failure |
| 4 | Add checklist/comment | Any user | RLS INSERT | Comment notification triggered |
| 5 | Activity logged to `planner_activity_log` | System | `logActivity()` helper | — |

**Postconditions:** Card in correct column; notifications sent; activity logged.

**Smoke tests:**
- ST-11.1: Create card → appears in column
- ST-11.2: Assign card → assignee receives notification
- ST-11.3: Drag card → sort order persisted

---

### WF-12: Database backup

**Trigger:** Admin clicks "Skapa backup" in admin panel
**Actor:** Admin
**Preconditions:** `database-backup` Edge Function deployed with `verify_jwt = false`

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | Client calls `database-backup` Edge Function | Admin | **No JWT verification** | Anyone with URL could call |
| 2 | Function queries all 48 public tables using service role | Edge Function | Service role key | — |
| 3 | Returns JSON with all table data | Edge Function | — | Large payload may timeout |
| 4 | Client generates downloadable JSON file | Client | — | — |

**Postconditions:** Complete JSON backup downloaded.

**Smoke tests:**
- ST-12.1: Admin downloads backup → JSON contains all tables
- ST-12.2: Non-admin should not have access (currently no server-side check)

---

### WF-13: Content indexing

**Trigger:** Content created/updated (trigger) or nightly batch (cron)
**Actor:** System
**Preconditions:** Triggers installed on source tables; `sync-content-index` deployed

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | Trigger fires on INSERT/UPDATE of source table | DB trigger | — | Trigger failure = stale index |
| 2 | UPSERT row in `content_index` | DB trigger | — | — |
| 3 | (Nightly) `sync-content-index` rebuilds full index | Edge Function | Service role | — |

**Postconditions:** `content_index` reflects current content state.

**Smoke tests:**
- ST-13.1: Publish news article → appears in AI search immediately
- ST-13.2: Trigger failure → nightly sync catches up

---

### WF-14: Recognition

**Trigger:** User sends recognition to colleague
**Actor:** Any authenticated user
**Preconditions:** Target user exists

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | Select recipient and write message | Sender | Client validation | — |
| 2 | INSERT into `recognitions` | Client | RLS INSERT | — |
| 3 | Create notification for recipient | Client | RPC `create_notification()` | Silent failure |

**Postconditions:** Recognition saved and recipient notified.

**Smoke tests:**
- ST-14.1: Send recognition → appears on culture page
- ST-14.2: Recipient receives notification
