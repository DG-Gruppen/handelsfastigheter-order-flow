# System Architecture – handelsfastigheter-order-flow

> This document describes how the system is currently built.
> For intended behavior, see `DOMAIN_RULES.md`.
> For analysis instructions, see `AI_ANALYSIS.md`.
>
> **Last reviewed:** 2026-03-20

---

## Overview

An internal operations platform built as a **thin-backend / fat-client hybrid**. Most business logic, authorization decisions, and approval routing run in the browser. The backend (Supabase) is used primarily for data storage, auth session management, and edge function execution.

This architecture trades backend complexity for frontend development speed, but shifts security and consistency responsibility to the client — which is safe only when properly compensated by backend enforcement. Currently, several of those compensating controls are missing.

**Stack:**

- React 18 + TypeScript + Vite
- Supabase (Auth, Database, RPC, Realtime, Edge Functions)
- Tailwind CSS + shadcn/ui
- TanStack Query (server state)
- React Router (routing)

---

## Layer Map

```
┌─────────────────────────────────────┐
│             Browser (React)         │
│                                     │
│  Auth Layer → Authorization Layer   │
│       ↓               ↓             │
│  Navigation Layer   Order System    │
│                         ↓           │
│              Approval Engine        │
└────────────────┬────────────────────┘
                 │ direct client calls
┌────────────────▼────────────────────┐
│              Supabase               │
│  Auth | DB | RPC | Edge Functions   │
│             Realtime                │
└─────────────────────────────────────┘
```

There is no middleware layer. All Supabase calls originate from the browser client. Edge Functions are invoked for email delivery and specific RPC operations but are not a general API gateway.

---

## Layer 1 – Authentication

**Hook:** `useAuth.tsx`

Responsibilities:
- Session management (Supabase Auth)
- User profile resolution
- Direct role fetches (`user_roles`)
- Group-derived role resolution (`group_members`)

Data sources for roles are combined in the hook. This means the effective role set is an aggregate computed in the browser from multiple async fetches. If any fetch is stale, errors, or returns before the session is fully established, the role set can be temporarily incorrect.

**Active risks:**
- Multiple async sources for roles create a window where the computed role set is incomplete or stale after login, token refresh, or tab resume.
- Auth events (`onAuthStateChange`) may trigger redundant profile/role fetches if not properly debounced or deduplicated.
- Missing error handling on profile or role fetches can leave the user in a partially-resolved auth state with no visible indication.

---

## Layer 2 – Authorization

**Hooks:** `useModules.tsx`, `useModulePermission.tsx`, `useAdminAccess.tsx`
**Component:** `ProtectedRoute.tsx`

Access is evaluated through a pipeline:

```
Authenticated user
  → Resolved roles (direct + group)
  → Module permissions (user + group-derived)
  → Route access decision (ProtectedRoute)
```

There is no single central authorization function. Permission logic is distributed across multiple hooks, each encoding part of the access model. This makes it possible for the same user to have inconsistent access across different parts of the application if any hook applies a different interpretation of the same role or permission.

**Active risks:**
- No shared invariant between the route guard, admin guard, and per-module hooks. A change to one does not automatically propagate to the others.
- Admin access is gated by `useAdminAccess` in the UI. If the underlying Supabase tables do not enforce the same restrictions via RLS, admin-level data can be read or written by non-admin users with direct API access.
- Module slug values are referenced in multiple places. Drift between definitions causes sections to become incorrectly hidden or incorrectly exposed.

---

## Layer 3 – Navigation

**Hook:** `useNavSettings.tsx`

Navigation items can be enabled or disabled via database settings. The hook reads these settings and conditionally renders routes.

**Active risk:** Disabling a route in navigation does not make it unreachable. A user who knows the URL can navigate directly to a disabled route. Navigation state is a UI concern, not an authorization control.

---

## Layer 4 – Order System

**Pages:** `NewOrder.tsx`, `OrderDetail.tsx`
**Core tables:** `orders`, `order_items`, `order_systems`

### Creation flow

```
1. resolveApprovalRouting()   ← runs in browser
2. INSERT into orders
3. INSERT into order_items
4. INSERT notification
5. Invoke edge function (email)
```

Steps 2 and 3 are sequential client-side inserts with no wrapping transaction. A failure between them produces an orphaned `orders` row with no items — an invalid state per domain rules.

Steps 4 and 5 are side effects. Their failure does not roll back the order, and there is no guaranteed retry or user-visible error for partial failure.

### Detail / action flow

`OrderDetail.tsx` handles:
- Approve
- Reject  
- Deliver

Each action updates the order row and triggers a notification and email. Local UI state is updated optimistically in some cases, which can mask backend failure or write conflicts.

**Active risks:**
- No transaction wrapping steps 2–3.
- Partial side-effect failure (notification sent, email failed) is not surfaced consistently.
- Optimistic UI updates may diverge from actual database state after a failed write.

---

## Layer 5 – Approval Engine

**Function:** `resolveApprovalRouting(...)` in `NewOrder.tsx`

Determines:
- Whether the order auto-approves
- Whether CEO approval is required
- Which user is assigned as `approver_id`

This function runs entirely in the browser. The result (including `approver_id`) is submitted as part of the order insert payload. The backend does not independently verify the routing decision.

This means a manipulated client can:
- Submit an order with a forged `approver_id`
- Force auto-approval by omitting or falsifying the approval flag
- Route an order to an unintended approver

**This is the highest-severity architectural risk in the system.** Approval routing must be moved server-side (RPC or Edge Function) to be trustworthy.

---

## Layer 6 – Admin System

**Page:** `Admin.tsx`
**Access hooks:** `useAdminAccess`, module permissions

Admin sections are lazy-loaded and conditionally rendered based on the result of `useAdminAccess`. If the hook returns false, the section is not rendered.

**Active risk:** This is UI-only gating. If RLS policies on the underlying tables do not restrict write access to admin-role users, the protection is bypassable via direct API calls.

---

## Layer 7 – Realtime

Supabase Realtime channels are used to push updates to the UI when order state changes. Reloads are debounced to reduce redundant fetches.

**Active risks:**
- A debounce gap means the UI can be briefly stale after a database change.
- Auth state changes (token refresh, re-login) may trigger realtime reconnection events that cause duplicate data fetches alongside existing TanStack Query invalidations.

---

## Current Architecture Risks – Summary

| Layer | Risk | Severity |
|-------|------|----------|
| Approval Engine | Routing computed and trusted from browser | Critical |
| Authorization | No backend enforcement of access decisions | High |
| Order System | No transaction for order + items write | High |
| Login | Domain restriction client-side only | High |
| Admin | UI-only gating of sensitive sections | High |
| Auth | Stale role state after token refresh | Medium |
| Realtime | Debounce gaps and duplicate fetch triggers | Low |

---

## Recommended Hardening Path

In priority order:

1. **Move approval routing server-side** — RPC function that resolves `approver_id` and validates the result before inserting the order.
2. **Atomic order creation** — Single RPC call for `orders` + `order_items` insert.
3. **RLS enforcement for admin and approver actions** — Approve, reject, and deliver must be gated by `auth.uid()` checks at the database level.
4. **Domain restriction at auth layer** — Enforce in an auth hook or Edge Function, not in `Login.tsx`.
5. **Central permission resolver** — Single shared function that all hooks delegate to, preventing drift between route guard, admin guard, and module hooks.
