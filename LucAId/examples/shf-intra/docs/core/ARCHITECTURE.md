## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.4.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for system layers, data flows, trust boundaries, and enforcement ownership
- Depends On: `core/DOMAIN_RULES.md`
- Used By: `core/AI_ANALYSIS.md`, `core/WORKFLOW_MAPS.md`, `governance/KNOWN_RISKS.md`
- Owner: DG Gruppen
- Update Triggers: new layers or integration patterns, new edge functions, new scheduled jobs, Supabase config changes, backend guarantees implemented

---

## Purpose

Describes how SHF Intra is currently built. For intended behavior, see `core/DOMAIN_RULES.md`. For risk descriptions and statuses, see `governance/KNOWN_RISKS.md` — this file holds a pointer table only.

---

## Overview

SHF Intra is a **thin-backend / fat-client hybrid** React SPA. Most business logic, authorization decisions, and approval routing run in the browser. The backend (Supabase) handles data storage, auth session management, real-time subscriptions, and edge function execution.

This architecture shifts security and consistency responsibility to the client. It is only safe when properly compensated by server-side enforcement. Several compensating controls are currently missing — see `governance/KNOWN_RISKS.md`.

**Stack (VERIFIED):**
- React 18 + TypeScript + Vite
- Supabase (Auth, Database, RLS, RPC, Realtime, Edge Functions / Deno runtime)
- Tailwind CSS + shadcn/ui
- TanStack Query
- React Router
- @dnd-kit (Planner)
- pgmq (email queue)
- pg_cron (scheduled jobs)
- Resend + Lovable Email (transactional email)
- Lovable AI Gateway — model: `google/gemini-3-flash-preview`
- Firecrawl (web scraping)
- Cision RSS (press release import)
- Google Workspace OAuth (SSO, `hd: "handelsfastigheter.se"`)

---

## Trust boundary

| Layer | Trust level | Notes |
|---|---|---|
| `src/**` | **Untrusted** — client-side | UI convenience only; any user can manipulate |
| Supabase Auth | **Trusted** — managed | Session validity enforced server-side |
| Database RLS policies | **Trusted** — server-side | Final data-layer enforcement |
| `supabase/functions/**` (Deno) | **Trusted** — server-side | Final enforcement for RPCs and email |
| `supabase/migrations/**` | **Trusted** — server-side | Schema, RLS policies, RPC definitions |
| pgmq / pg_cron | **Trusted** — server-side | Scheduled and queued operations |

Any security control that exists only in `src/**` must be treated as a UI convenience, not a security control.

---

## System layer map

```
┌─────────────────────────────────────────────────┐
│                  Browser (React)                │
│                                                 │
│  Auth Layer → Permission Chain → Module Pages  │
│                    ↓                            │
│          Order / Document / Planner /           │
│          Password / Admin / etc.                │
└──────────────────┬──────────────────────────────┘
                   │ direct Supabase client calls
        ┌──────────▼──────────┐
        │    Edge Functions    │  ← AI, email, impersonation,
        │       (Deno)         │    backup, scraping, passwords key
        └──────────┬──────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│                  Supabase                        │
│   Auth | DB + RLS | RPC | Realtime | Storage     │
│              pgmq | pg_cron                      │
└─────────────────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  External services  │
        │  Resend | Lovable   │
        │  Firecrawl | Cision │
        │  Google OAuth       │
        └─────────────────────┘
```

---

## Layer 1 — Authentication

**Hook:** `useAuth.tsx` (AuthProvider)

Responsibilities: session management, profile loading, direct role fetch (`user_roles`), group-derived role resolution (`group_members` + `groups.role_equivalent`), role merge.

**Role merge:** Direct and group-derived roles merged via `new Set()`. Intended precedence: direct > group-derived. Consuming code must apply this priority explicitly — the merge itself does not enforce it.

**Enforcement owner:** Supabase Auth (session validity); `useAuth.tsx` (role resolution, frontend-only).

---

## Layer 2 — Permission chain

**Hooks:** `useModules.tsx` → `useModulePermission.tsx` + `useAdminAccess.tsx`
**Component:** `ProtectedRoute.tsx`

Four-step pipeline:
```
Authenticated user
  → Resolved roles (direct + group, via useAuth)
  → Module list + permissions (useModules; Realtime on module_permissions)
  → Route access decision (ProtectedRoute → useModuleAccess)
  → Admin section access (useAdminAccess → slug → module permission)
```

No single central authorization function. Permission logic is distributed across four hooks — a change to one does not propagate to others.

**Enforcement owner:** Frontend only. No confirmed backend equivalent for route-level decisions.

---

## Layer 3 — Navigation

**Hook:** `useNavSettings.tsx` (NavSettingsProvider)

Reads `org_chart_settings` as key-value config for nav route disabling, theme defaults, and IT remote help URL. **Reads occur pre-auth on the login page** — this exposes internal configuration to unauthenticated contexts.

Disabling a route in nav does not make it unreachable — direct URL access is always possible.

**Enforcement owner:** Frontend only.

---

## Layer 4 — Order system

**Pages:** `NewOrder.tsx`, `OrderDetail.tsx`, `History.tsx`
**Tables:** `orders`, `order_items`, `order_types`, `categories`, `systems`, `order_systems`

Creation flow:
```
1. resolveApprovalRouting()    ← runs in browser
2. INSERT orders
3. INSERT order_items
4. INSERT notification
5. Invoke send-email edge function
```

Steps 2–3 are sequential client-side inserts with no transaction. Steps 4–5 are independent side effects.

**Enforcement owner:** Frontend only (approval routing, `isPrivileged` check). No confirmed server-side transaction or routing validation.

---

## Layer 5 — Document system

**Page:** `Documents.tsx`
**Tables:** `document_folders`, `document_files`
**Storage:** `documents` bucket

Access control: `has_folder_access(folder_id, user_id)` and `has_folder_write_access(folder_id, user_id)` DB functions evaluate `access_roles` and `write_roles` per folder recursively.

**Risk:** Storage bucket access may not be gated by the same RLS as the DB records — a direct storage URL may bypass folder-level access control.

**Enforcement owner:** DB functions for metadata; storage RLS status UNKNOWN.

---

## Layer 6 — Password vault

**Page:** `Passwords.tsx`
**Lib:** `passwordCrypto.ts`
**Tables:** `shared_passwords`, `shared_password_groups`, `password_access_log`
**Edge function:** `get-passwords-key`

Encryption model:
```
1. get-passwords-key returns AES key to any authenticated user
2. Client decrypts password_value using the key
3. Access control: shared_password_groups RLS determines which passwords are visible
```

The AES key is the same for all passwords and is returned to any authenticated request. Data-level access control is entirely dependent on `shared_password_groups` RLS being correct.

**Enforcement owner:** `get-passwords-key` for key issuance (authentication check only, no group check); RLS on `shared_passwords` for data access.

---

## Layer 7 — Planner

**Page:** `Planner.tsx`
**Tables:** `planner_boards`, `planner_columns`, `planner_cards`, `planner_checklists`, `planner_checklist_items`, `planner_card_comments`, `planner_card_attachments`, `planner_activity_log`
**Storage:** Attachments bucket

Uses @dnd-kit for drag-and-drop with optimistic updates. Activity is logged to `planner_activity_log`. Attachments stored in Supabase Storage.

**Enforcement owner:** Module permission (`can_edit` on `planner` slug); storage RLS status UNKNOWN for attachments.

---

## Layer 8 — Admin system

**Page:** `Admin.tsx`
**Hooks:** `useAdminAccess.tsx`

Multiple tabs: categories, equipment, systems, knowledge, news, tools, users, groups, permissions, settings, IT, backup, workwear.

Access: admin/IT role OR `can_edit` on mapped module slug via `useAdminAccess`. UI-only gating — RLS on underlying tables is the actual enforcement boundary.

**Enforcement owner:** Frontend (section visibility); DB RLS (mutation authority — status varies by table).

---

## Layer 9 — AI assistant

**Component:** `AiChatBubble.tsx`
**Edge function:** `ai-chat`
**Table:** `content_index`

Flow:
```
User query → ai-chat edge function → searches content_index (fts) → 
Lovable AI Gateway (gemini-3-flash-preview) → SSE stream to client
```

`content_index` aggregates: news, kb_articles, kb_videos, document_files, ceo_blog, scraped web content. Updated via real-time DB triggers AND batch `sync-content-index` edge function. Both paths must stay consistent.

**Risk:** If `content_index` contains unpublished or access-restricted content, the AI may surface it to any authenticated user. No per-user access filtering on indexed content confirmed.

**Enforcement owner:** Content indexing logic (which content is indexed); no per-user filtering confirmed in `ai-chat`.

---

## Layer 10 — Email system

**Two channels:**

**Direct (Resend):** `send-email` edge function called from frontend. Used for helpdesk and simple notifications. No queue.

**Queue-based (pgmq):** Auth emails and transactional notifications enqueued via `enqueue_email` DB function. Processed by `process-email-queue` edge function on pg_cron schedule. Has retry logic, DLQ, rate limiting, TTL expiry.

```
Frontend/DB trigger → enqueue_email() → pgmq queue
pg_cron → process-email-queue edge function → Lovable Email API → email_send_log
                                            ↓ on failure
                                          DLQ (move_to_dlq)
```

**Risk:** DLQ accumulation has no alerting mechanism — silent failure accumulation possible.

**Enforcement owner:** pgmq + pg_cron (server-side); `email_send_state` for rate limiting.

---

## Layer 11 — Content indexing

**Tables:** `content_index`
**Edge functions:** `sync-content-index`, `scrape-website`, `scrape-allabolag`, `fetch-cision-feed`
**Schedule:** pg_cron nightly at 02:00 (scraping), every 12h (Cision)

Dual indexing strategy:
- Real-time: DB triggers on source tables update `content_index` on insert/update/delete
- Batch: `sync-content-index` performs full re-index; `scrape-website`/`scrape-allabolag` add external content

**Risk:** If both paths are active and diverge, `ai-chat` returns inconsistent results. Nightly scraping jobs that fail silently leave external content stale.

---

## Layer 12 — Impersonation

**Edge function:** `impersonate-user`
**Component:** `ImpersonationBanner.tsx`

IT/admin can generate a real Supabase session token for another user. Intended for support purposes.

```
Admin panel → impersonate-user edge function (IT role check) → 
Supabase Admin API → { access_token, refresh_token } → 
Frontend stores tokens → full session as target user
```

**Risk:** If server-side IT role check in the edge function is absent or bypassable, any authenticated user could impersonate any other user.

**Enforcement owner:** `impersonate-user` edge function (server-side role check — status INFERRED, not VERIFIED from inspected code).

---

## Risk pointer table

Full entries in `governance/KNOWN_RISKS.md`.

| Layer | Risk summary | Severity |
|---|---|---|
| Order / Approval Engine | Routing computed and trusted from browser | Critical |
| Permission Chain | No backend enforcement of route access | High |
| Order System | No transaction for order + items write | High |
| Login / Auth | Domain restriction client-side only | High |
| Admin | UI-only gating; RLS status varies | High |
| Password Vault | AES key returned to all authenticated users | High |
| Document Storage | Storage bucket URL bypass possible (unverified) | High |
| Impersonation | Server-side role check unverified | High |
| Auth | Role merge precedence unverified | Medium |
| Navigation | Nav settings read pre-auth | Medium |
| Realtime | Silent channel failure = stale permissions | Medium |
| AI Assistant | Unpublished content potentially indexed and retrievable | Medium |
| Email Queue | DLQ accumulation without alerting | Medium |
| Content Index | Dual-path staleness divergence | Medium |

---

## Recommended hardening path

1. Move approval routing server-side (RPC)
2. Atomic order creation RPC (`orders` + `order_items`)
3. RLS for approve/reject/deliver with `auth.uid()` and status predicate
4. Verify `impersonate-user` server-side role check
5. Verify storage RLS on `documents` bucket
6. Add group membership check to `get-passwords-key` before returning AES key
7. Domain restriction at Edge Function or auth hook level
8. Central permission resolver — single shared function all hooks delegate to
9. Content index access filtering in `ai-chat` for restricted content
10. DLQ alerting in `process-email-queue`

When any is implemented, update `governance/KNOWN_RISKS.md` and this pointer table.

---

## Code review reading order

1. `src/main.tsx`, `src/App.tsx`
2. Auth and module hooks (`useAuth`, `useModules`, `useModulePermission`, `useAdminAccess`, `useNavSettings`)
3. `src/components/ProtectedRoute.tsx`
4. Order pages (`NewOrder`, `OrderDetail`, `History`)
5. Sensitive pages (`Passwords`, `Documents`, `Admin`)
6. Other module pages
7. `src/lib/**`, `src/integrations/**`
8. `supabase/functions/**`
9. `supabase/migrations/**`
