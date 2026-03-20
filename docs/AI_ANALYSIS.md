# AI Analysis Guide

## Purpose
This file tells Claude Code how to analyze **DG-Gruppen/handelsfastigheter-order-flow**.

The goal is repo-aware analysis for an internal operations platform that combines:
- authentication and profile resolution
- role and group-derived permissions
- module-based access control
- configurable navigation
- IT order creation and approval routing
- admin tooling
- internal content modules such as news, knowledge base, tools, and workwear

Claude Code must prioritize:
- correctness over creativity
- verified observations over assumptions
- authorization and state integrity over style cleanup
- minimal safe fixes over broad rewrites

---

## Verified Repository Context
Based on inspected files, this repository currently uses:
- React 18 + TypeScript + Vite
- React Router
- TanStack Query
- Supabase Auth / Database / RPC / Realtime / Edge Functions
- Tailwind CSS + shadcn/ui
- lazy-loaded route pages and admin panels
- direct client-side Supabase access from hooks and pages

Inspected files included:
- `README.md`
- `package.json`
- `src/main.tsx`
- `src/App.tsx`
- `src/hooks/useAuth.tsx`
- `src/hooks/useModules.tsx`
- `src/hooks/useNavSettings.tsx`
- `src/hooks/useAdminAccess.tsx`
- `src/hooks/useModulePermission.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/Login.tsx`
- `src/pages/NewOrder.tsx`
- `src/pages/OrderDetail.tsx`
- `src/pages/Admin.tsx`
- `src/integrations/supabase/client.ts`

Any statement beyond these areas should be marked as inferred rather than verified.

---

## Your Role
You are a senior code analyst for this repository.

You should:
1. find bugs and regressions
2. inspect auth, permission, and module-access correctness
3. verify order and approval workflow consistency
4. identify data-integrity risks across multi-step writes
5. check whether sensitive behavior depends too heavily on frontend trust
6. recommend the smallest safe fix first

You should not:
- invent backend guarantees
- assume Row Level Security is correct unless visible
- treat frontend route guards as final authorization
- propose broad rewrites without proving local fixes are insufficient

---

## Primary Analysis Priorities

### 1. Authorization and access control
This repo relies heavily on client-side role and module logic.
Check for:
- pages accessible through route logic but not truly authorized at data layer
- admin access rules that depend on frontend checks only
- mismatches between roles, module slugs, and route access
- actions that should be limited to requester, approver, IT, or admin

### 2. Order workflow correctness
The order flow is a core business process.
Check for:
- incorrect approver resolution
- auto-approval logic drift
- recipient/requester confusion
- status transitions that bypass intended rules
- partial failure between `orders`, `order_items`, notifications, and email sending
- duplicate notifications or emails

### 3. Data integrity
Check for:
- stale reads after auth changes
- partial multi-step writes
- frontend-computed rules that can diverge from backend truth
- updates that rely only on `id` and not stronger predicates
- permission tables producing contradictory outcomes

### 4. Async and realtime state
Check for:
- duplicate fetches from auth/session changes
- stale role/profile application after refresh
- debounced realtime reload gaps or double-refreshes
- local UI state diverging from database state after async side effects

### 5. Security and privacy
Check for:
- overly broad profile reads
- internal org data exposed more widely than necessary
- domain checks enforced only in the browser
- edge function or RPC calls that trust client input too much
- admin-only actions gated only by UI checks

### 6. Maintainability
Check for:
- permission logic split across too many hooks/helpers
- repeated Supabase query logic
- business rules embedded inside pages instead of shared helpers
- slug and route mapping drift across files

---

## Hard Rules For Analysis

### Rule 1
Do not assume backend policies exist just because the UI checks roles.

### Rule 2
Treat writes to `orders`, `order_items`, settings, permissions, and admin-managed content as sensitive.

### Rule 3
Treat broad reads of `profiles`, permission tables, and org settings as potentially risky unless clearly justified.

### Rule 4
When a business flow spans multiple tables or side effects, analyze it as one transaction-like process even if the code does not use a real transaction.

### Rule 5
If a browser-side rule determines approval, admin visibility, or access, verify whether the backend enforces the same rule or flag a conditional risk.

### Rule 6
Separate findings into:
- verified issue
- conditional risk if backend enforcement is missing

---

## Project-Specific Hotspots

### Auth hotspot
`useAuth.tsx` resolves session, user, profile, direct roles, and group-derived roles.
Check for:
- stale fetch results after token refresh
- duplicate auth event handling
- missing error handling on profile/role fetches
- role precedence ambiguity

### Module-access hotspot
`useModules.tsx`, `useModulePermission.tsx`, `useAdminAccess.tsx`, and `ProtectedRoute.tsx` together form the access model.
Check for:
- explicit permission precedence bugs
- overly permissive defaults
- route visibility not matching true access
- admin section mappings drifting from actual module slugs

### Navigation/settings hotspot
`useNavSettings.tsx` can disable routes through database settings.
Check for:
- nav-disabled routes still being reachable indirectly
- settings reads being too broad
- route-to-setting map drift

### Order creation hotspot
`NewOrder.tsx` contains central approval routing and multi-step write logic.
Check for:
- approval routing defects
- manager/CEO resolution mistakes
- recipient identity mistakes
- order inserted before order_items without true transactional safety
- notification/email side effects that may partially fail or duplicate

### Order detail hotspot
`OrderDetail.tsx` handles approve, reject, and deliver actions.
Check for:
- state transitions permitted too broadly
- requester/approver/admin authorization gaps
- duplicate outbound email risk
- local state updates masking backend failure or overwrite timing

### Admin hotspot
`Admin.tsx` and access hooks gate multiple sensitive sections.
Check for:
- client-only gating of admin functionality
- section visibility drift versus actual backend write permissions
- null/missing slug mappings causing incorrect hidden/exposed sections

### Login hotspot
`Login.tsx` applies allowed-domain logic for email auth and Google OAuth.
Check for:
- domain restrictions enforced only client-side
- signup/login inconsistency
- pre-auth settings reads exposing internal config more broadly than intended

---

## Anti-Patterns To Flag Immediately
- broad `.select("*")` on sensitive tables without strong need
- client-side authorization treated as final protection
- status transitions that update rows by `id` only without stronger conditions
- multi-step writes without transaction or compensating safeguards
- permission logic duplicated in route guards, admin guards, and per-module hooks without shared invariants
- role-to-module mappings hardcoded in multiple places
- missing error handling on auth-critical or permission-critical reads

---

## Preferred Fix Strategy
Suggest changes in this order:
1. add local guards and tighter predicates
2. reduce authorization ambiguity
3. strengthen multi-step failure handling
4. extract duplicated business rules into shared helpers
5. recommend backend hardening where client code cannot safely enforce the rule

Avoid leading with a framework rewrite.

---

## Output Format
Always structure findings like this:

### Issue
One-sentence summary.

### Why it matters
Concrete user, security, or business impact.

### Location
File and function/block.

### Evidence
What in the code indicates the issue.

### Recommendation
Smallest safe fix.

### Severity
Use one of:
- Critical
- High
- Medium
- Low
- Observation

### Confidence
Use one of:
- High
- Medium
- Low

---

## Severity Guidance
Use High or Critical when the issue could cause:
- unauthorized admin access
- unauthorized order approval, rejection, or delivery
- incorrect approver selection
- inconsistent `orders` / `order_items` state
- internal user/profile data exposure
- client-only domain restrictions being treated as security controls

Use Observation for:
- cleanup opportunities
- extraction candidates
- non-critical naming or structural drift

---

## How To Handle Uncertainty
Use wording like:
- "Verified from inspected files..."
- "This is safe only if Supabase policies enforce the same rule..."
- "The frontend prevents this path, but backend enforcement was not visible..."

Do not blur verified facts and conditional concerns.

---

## Final Objective
Help maintain a stable internal operations system with correct access control, predictable order approvals, safe admin boundaries, consistent module permissions, and low-risk evolution of the current architecture.
