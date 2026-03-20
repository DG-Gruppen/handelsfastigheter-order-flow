# ARCHITECTURE_v2

## Overview
`handelsfastigheter-order-flow` is a frontend-driven internal operations system built with:
- React 18 + TypeScript + Vite
- Supabase Auth / DB / RPC / Realtime / Edge Functions
- Tailwind + shadcn/ui
- TanStack Query

The current architecture is best described as:

**thin backend + fat client orchestration**

A large share of business logic is implemented in the frontend, especially around:
- auth resolution
- role merging
- module access
- navigation gating
- order creation
- approval routing
- admin visibility

---

## Architectural Layers

### 1. App Shell Layer
Key file:
- `src/App.tsx`

Responsibilities:
- app providers
- router
- query client
- protected layout
- route registration
- lazy loading of major pages

Observed providers:
- `ThemeProvider`
- `QueryClientProvider`
- `AuthProvider`
- `NavSettingsProvider`
- `ModulesProvider`

Implication:
- most business decisions happen after provider hydration, not through a dedicated backend gateway

---

### 2. Auth and Identity Layer
Key file:
- `src/hooks/useAuth.tsx`

Responsibilities:
- subscribe to auth state
- restore session
- fetch current profile
- fetch direct roles
- fetch group-derived role equivalents
- merge role sources

Inputs:
- Supabase auth session
- `profiles`
- `user_roles`
- `group_members -> groups.role_equivalent`

Outputs:
- `user`
- `session`
- `profile`
- `roles`
- `loading`

Architectural risk:
- identity and authorization context are assembled client-side from multiple tables

---

### 3. Authorization Layer
Key files:
- `src/hooks/useModules.tsx`
- `src/hooks/useModulePermission.tsx`
- `src/hooks/useAdminAccess.tsx`
- `src/components/ProtectedRoute.tsx`

Responsibilities:
- load modules
- load module access rules
- load explicit permissions
- derive accessible modules
- derive admin section visibility
- gate routes

Inputs:
- `modules`
- `module_role_access`
- `module_permissions`
- `group_members`
- auth roles
- hardcoded admin section slug mapping

Architectural risk:
- access logic is distributed across several helpers rather than enforced from one authoritative backend decision layer

---

### 4. Navigation Configuration Layer
Key file:
- `src/hooks/useNavSettings.tsx`

Responsibilities:
- load org settings
- map route → setting key
- determine whether route is disabled in frontend

Architectural risk:
- route disablement appears to be primarily frontend-driven
- direct URL access may not equal hidden navigation state

---

### 5. Order Domain Layer
Key files:
- `src/pages/NewOrder.tsx`
- `src/pages/OrderDetail.tsx`

Core tables inferred from inspected code:
- `orders`
- `order_items`
- `order_systems`
- `profiles`
- notification RPC
- email edge function / helpers

Responsibilities:
- resolve approver
- create order
- create items
- notify approver
- send approval emails
- approve / reject / deliver order
- notify requester
- send outbound confirmation/delivery/rejection emails

Architectural risk:
- one business workflow spans DB writes, RPC, email, and UI state without true transaction boundaries

---

### 6. Admin Layer
Key file:
- `src/pages/Admin.tsx`

Responsibilities:
- render admin dashboard
- show or hide admin sections
- lazy-load admin management panels

This layer is heavily coupled to authorization helpers and hardcoded section mappings.

Architectural risk:
- visibility logic and actual server-side write authority may diverge

---

## Concrete Data Flows

### A. Auth Resolution Flow
1. App mounts providers in `App.tsx`
2. `AuthProvider` subscribes to Supabase auth changes
3. `AuthProvider` also checks current session
4. On session presence, it fetches in parallel:
   - profile
   - direct user roles
   - group-derived roles
5. Role arrays are merged client-side
6. The resulting auth context feeds:
   - `ProtectedRoute`
   - `ModulesProvider`
   - `NavSettingsProvider`
   - admin access helpers

Failure implications:
- if profile or role fetches fail silently, route and permission decisions may be wrong or incomplete

---

### B. New Order Creation Flow
1. User opens `NewOrder.tsx`
2. Page loads:
   - categories
   - order types
   - profiles
   - all profiles
   - roles via RPC
   - current profile
   - category/department mappings
   - type/department mappings
   - approval settings
   - departments
3. Frontend derives:
   - filtered visible categories/types
   - CEO profile
   - manager profile
   - approval routing
4. On submit:
   - validate current form
   - call `resolveApprovalRouting(...)`
   - insert `orders`
   - insert `order_items`
   - if items fail, delete order row as compensating rollback
   - if pending, notify approver and maybe email approver
   - if auto-approved, notify/helpdesk/email requester
5. UI redirects to dashboard

Failure implications:
- no true transaction
- side effects after DB writes may partially fail
- approval authority is derived in browser logic

---

### C. Order Approval / Delivery Flow
1. User opens `OrderDetail.tsx`
2. Page loads:
   - `orders`
   - `order_items`
   - `order_systems`
   - requester and approver profiles
3. Realtime channel listens for order row changes
4. UI derives:
   - canApprove
   - admin delivery action
5. On approve:
   - update `orders.status = approved`
   - notify requester
   - send requester email
   - send helpdesk email
6. On reject:
   - update `orders.status = rejected`
   - notify requester
   - send rejection email
7. On deliver:
   - update `orders.status = delivered`
   - notify requester
   - send delivery email

Failure implications:
- transitions appear update-by-id based
- frontend controls action visibility
- partial side-effect failures can occur after status update

---

## Current Trust Boundaries

### Frontend-trusted decisions observed
The browser currently appears to determine:
- approver routing
- who can see admin sections
- who can approve/reject/deliver in UI
- which modules a user can access
- whether some routes are disabled

### Backend-trusted decisions not verified
Not visible from inspected files:
- exact Row Level Security policies
- database constraints on lifecycle transitions
- RPC validation for approval/security rules
- edge function authorization checks

This means any strong authorization claim must be treated as unverified unless backend code/policies are also reviewed.

---

## Architectural Strengths
- clear provider structure
- modular route organization
- access logic extracted into hooks rather than scattered entirely in pages
- approval routing isolated in a dedicated helper function inside order creation
- realtime refresh is at least partially debounced

---

## Architectural Weaknesses
- business-critical rules live in frontend
- authorization logic is layered but not centrally authoritative
- order workflow is not transaction-safe
- permission precedence is implicit rather than formalized
- route visibility and true backend authority may diverge
- compensating rollback exists, but only for one part of the order workflow

---

## Recommended Evolution Path
Prefer these improvements in order:

1. formalize permission precedence in one place
2. move approval-critical decisions to backend validation or RPC
3. wrap order create/approve/reject/deliver flows in server-side transaction-like logic
4. tighten update predicates for sensitive state transitions
5. keep frontend hooks as view-model helpers, not final authority

---

## Summary
This system is not badly structured, but it is carrying too much authority in the frontend.

Most important architectural truths:
- auth context is assembled client-side
- access control is layered and distributed
- order flow spans multiple side effects without hard transaction boundaries
- backend enforcement may exist, but it is not visible from the inspected frontend snapshot

Claude Code should analyze this repo with those constraints in mind.
