# AI_ANALYSIS_v2

## Purpose
This file tells Claude Code how to analyze **DG-Gruppen/handelsfastigheter-order-flow** with stronger evidence discipline and clearer separation between:

- intended business behavior
- observed frontend implementation
- unknown or unverified backend enforcement

The goal is not generic review. The goal is accurate, low-hallucination analysis of:
- authentication
- role and group-derived permissions
- module access
- navigation gating
- order creation and approval flow
- admin actions
- notifications and email side effects

---

## Core Review Principles

Prioritize:
1. correctness
2. authorization integrity
3. data integrity
4. transactional safety
5. evidence-backed conclusions
6. smallest safe fix first

Avoid:
- inventing backend guarantees
- assuming Row Level Security exists unless visible
- treating route guards as final authorization
- recommending broad rewrites before local fixes are considered

---

## Verified Repository Context
Based on inspected files, the repo currently uses:
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

Anything beyond these areas must be labeled as inferred unless verified from code.

---

## Evidence Rules
Claude Code must follow these evidence rules on every review:

1. Always cite exact file and function/block.
2. Separate:
   - observed code behavior
   - inferred architecture
   - unknown backend enforcement
3. Do not escalate severity without explaining blast radius.
4. When backend policy is unknown, mark as:
   - conditional risk
   - not confirmed vulnerability
5. If a rule appears enforced only in the browser, say:
   - frontend enforcement observed
   - backend enforcement not verified

---

## Output Format
Always structure findings like this:

### Issue
One-sentence summary.

### Type
One of:
- Verified bug
- Verified design risk
- Conditional security risk
- Maintainability issue
- Observation

### Why it matters
Concrete business, user, or security impact.

### Location
File and function/block.

### Evidence
Observed code path and why it suggests the issue.

### Backend enforcement status
Use one of:
- Verified present
- Not visible
- Unclear

### Recommendation
Smallest safe fix first.

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

## Severity Rules

### Critical
Use only when the issue could directly enable:
- unauthorized admin capability
- unauthorized approval/rejection/delivery
- severe data corruption
- exposure of sensitive internal data at scale

### High
Use when the issue could cause:
- wrong approver resolution
- inconsistent order/order_items state
- privilege drift with real impact
- serious but not fully proven authorization bypass

### Medium
Use when the issue causes:
- partial workflow failure
- stale state
- repeated side effects
- incorrect UX that may affect business flow

### Low
Use for:
- minor correctness gaps
- weak error handling
- cleanup that reduces risk but is not urgent

### Observation
Use for:
- architectural notes
- extraction opportunities
- naming/structure drift

---

## Primary Analysis Priorities

### 1. Authorization and Access Control
Check:
- whether route access matches true intended access
- whether admin actions depend only on UI gating
- whether requester / approver / admin / IT boundaries are clear
- whether permission precedence is deterministic

### 2. Order Workflow Correctness
Check:
- approver resolution
- auto-approval logic
- status transitions
- requester vs recipient semantics
- side effects across notifications and email
- partial failure handling

### 3. Data Integrity
Check:
- multi-step writes without transaction
- deletes used as rollback
- stale or conflicting permission data
- updates based only on `id`
- duplicated or repeated effects

### 4. Auth and Session State
Check:
- stale profile/role application
- duplicate auth-driven fetches
- profile fetch failure handling
- race conditions on refresh or auth event changes

### 5. Security and Privacy
Check:
- broad profile reads
- pre-auth reads of org settings
- frontend-only domain restrictions
- edge function or RPC calls trusting client input too much

### 6. Maintainability
Check:
- permission logic scattered across multiple hooks
- business rules embedded inside page components
- mapping drift between slugs, routes, admin sections, and settings keys

---

## Project Hotspots

### Auth hotspot
`src/hooks/useAuth.tsx`
- session listener
- profile fetch
- role merge
- loading resolution

Questions:
- Can stale fetch results land after auth refresh?
- What happens if one of the three parallel reads fails?
- Is role precedence explicit enough?

### Module/Permission hotspot
`src/hooks/useModules.tsx`
`src/hooks/useModulePermission.tsx`
`src/hooks/useAdminAccess.tsx`
`src/components/ProtectedRoute.tsx`

Questions:
- Which permission source wins on conflict?
- Is “no rule means allow” intentional everywhere?
- Can admin UI access diverge from actual writable backend actions?

### Navigation hotspot
`src/hooks/useNavSettings.tsx`
Questions:
- Is nav disablement merely cosmetic?
- Are disabled routes still callable by URL?

### Order creation hotspot
`src/pages/NewOrder.tsx`
Questions:
- Is approval routing purely frontend?
- Can order row and order_items drift apart?
- Can notifications or emails duplicate or partially fail?
- Is recipient selection over-broad for privileged users?

### Order detail hotspot
`src/pages/OrderDetail.tsx`
Questions:
- Are approve/reject/deliver transitions enforced only in UI?
- Can status be changed with insufficient predicates?
- Can email sending or notification creation duplicate?

### Admin hotspot
`src/pages/Admin.tsx`
Questions:
- Are hidden sections truly forbidden or just not shown?
- Can slug mismatches silently grant or block admin access?

### Login hotspot
`src/pages/Login.tsx`
Questions:
- Are allowed domains enforced beyond the browser?
- Is Google domain restriction mirrored in backend/session validation?

---

## Anti-Patterns To Flag Immediately
- broad `.select("*")` on sensitive tables without strong reason
- updates or deletes filtered only by `id` for sensitive transitions
- client-side authorization treated as final protection
- multi-step writes without transaction or compensating server logic
- duplicated permission rules in different hooks
- hardcoded permission mappings without one authoritative source
- weak error handling on auth-critical or permission-critical fetches

---

## Review Mode Guidance

### Whole-file review
Explain:
- file purpose
- observed risks
- business impact
- smallest safe improvements

### Cross-file workflow review
Trace:
- who initiates the action
- which tables are read
- which state determines authority
- what side effects occur
- where failure can leave inconsistent state

### Diff review
Focus on:
- regressions against current architecture
- widened access
- changed order lifecycle behavior
- changes to permission precedence
- new side effects or missing rollback

---

## Recommended Recommendation Style
Prefer:
1. tighten query/update predicates
2. add backend validation or RPC wrapper
3. extract shared rule into helper
4. improve error handling and rollback behavior
5. only then propose deeper refactor

Avoid leading with:
- new framework
- total rewrite
- large state-management migration

---

## Final Objective
Help maintain a stable internal operations system where:
- access decisions are predictable
- order lifecycle is safe
- approval rules are consistent
- admin boundaries are real
- findings are grounded in code evidence
