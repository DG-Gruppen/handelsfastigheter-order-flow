# Domain Rules – handelsfastigheter-order-flow

> **Ground truth for system behavior.**
> Claude Code and all developers must treat this file as the authoritative definition of how the system is intended to work.
> When code diverges from these rules, the code is wrong — not this document.
>
> **See also:** `ARCHITECTURE.md` (how it is built), `AI_ANALYSIS.md` (how to analyze it)
> **Last reviewed:** 2026-03-20

---

## 1. Order Lifecycle

### States

| State | Terminal | Description |
|-------|----------|-------------|
| `pending` | No | Awaiting approver action |
| `approved` | No | Approved; awaiting delivery |
| `rejected` | **Yes** | Declined by approver |
| `delivered` | **Yes** | Fulfilled by admin or IT |

### Permitted transitions

```
pending → approved
pending → rejected
approved → delivered
```

Any other transition (e.g., `rejected → approved`, `delivered → anything`) is **invalid** and must be blocked at both UI and backend level.

**Why terminal states matter:** Once an order is rejected or delivered, reopening it would create ambiguity in audit trails, duplicate notifications, and inconsistent approval history. Terminal states are irreversible by design.

---

## 2. Roles

| Role | Description |
|------|-------------|
| `admin` | Full system access including delivery actions and settings |
| `manager` | Can approve orders for their reports; may require CEO approval depending on order type |
| `it` | Can deliver approved orders; otherwise treated as staff for ordering purposes |
| `staff` | Standard employee; can create orders |
| `user` | Baseline authenticated user with no elevated permissions |

Roles can be assigned directly (`user_roles`) or inherited via group membership (`group_members`). Where both apply, direct roles take precedence unless admin override is active.

---

## 3. Approval Routing

### Central function

All approval routing is determined by `resolveApprovalRouting(...)` in `NewOrder.tsx`.

This is currently frontend-only. **This is a known risk.** See Section 10.

### Routing decision matrix

| Requester role | Condition | Outcome |
|----------------|-----------|---------|
| CEO | Always | Auto-approve |
| Manager / Admin | Order type requires CEO | Escalate to CEO approver |
| Manager / Admin | Order type allows self-approve | Auto-approve |
| Manager / Admin | Otherwise | Route to manager |
| Staff / IT | No manager resolvable | Auto-approve |
| Staff / IT | Manager exists | Route to manager |

> **Important:** This matrix represents the intended behavior as defined in `resolveApprovalRouting(...)` in `NewOrder.tsx`. The function is the current source of truth for routing logic. Any refactoring of that function must preserve all rows of this matrix exactly. If the code diverges from this matrix, the code is wrong.

### Edge cases that must be handled

- **Staff with a manager in the system:** Route to that manager. Do not auto-approve.
- **Manager ordering as a regular employee:** Apply manager rules, not staff rules. Role takes precedence over context.
- **Multiple managers in group:** Resolution priority must be deterministic. Currently undefined — flag as a risk.
- **CEO approval when no CEO account exists:** Must fail gracefully, not silently auto-approve.

### Approver ID requirement

Every non-auto-approved order **must** have a resolved `approver_id` before insertion. An order without an `approver_id` is an invalid state.

---

## 4. Permission System

### Layers (evaluated in order)

1. **Admin override** — if the user is admin, full access is granted regardless of other checks.
2. **Direct user permission** — explicit permission entry for the user in `module_permissions`.
3. **Group-derived permission** — permission inherited from a group the user belongs to (`group_members`).

### Rules

- A permission granted at a higher layer cannot be revoked by a lower layer.
- Module access and role access are separate concerns. A user may have a module enabled but lack the role to perform sensitive actions within it, and vice versa.
- Permissions must be evaluated server-side for any write or sensitive read. Frontend-only permission checks are UI conveniences, not security controls.

---

## 5. Order Creation

### Requirements

An order is only valid if it has:
- At least one `order_item`
- A `requester_id` (the authenticated user placing the order)
- A resolved `approver_id` (or explicit auto-approve flag)

### Intended creation flow

1. Insert row into `orders`
2. Insert rows into `order_items`
3. Insert notification for approver
4. Send email to approver

**Steps 1 and 2 must be treated as a single atomic operation.** An `orders` row without corresponding `order_items` is an inconsistent state.

**Steps 3 and 4 are side effects.** Their failure should not silently mark the order as successfully created from the user's perspective. Partial failure (order created, email not sent) must be surfaced or retried.

### Recipient rules

An order can be placed for the requester themselves or for another user (`recipient_type: "existing"`). The following rules apply:

| Recipient type | Permitted for |
|----------------|--------------|
| Self (default) | Any authenticated user |
| `existing` (another user) | Users with `isPrivileged` status — currently manager and admin roles |

Ordering on behalf of another user without `isPrivileged` is not permitted. This rule currently lives only in `NewOrder.tsx` and is not enforced server-side.

### Current gap

The codebase does not use a database transaction for steps 1–2. This means a crash between step 1 and step 2 produces an orphaned order. This must be resolved via an RPC function or compensating cleanup logic.

---

## 6. Action Authorization

| Action | Permitted roles |
|--------|----------------|
| Create order | Any authenticated user |
| Approve order | The resolved `approver_id` for that order only |
| Reject order | The resolved `approver_id` for that order only |
| Deliver order | `admin`, `it` |
| View all orders | `admin`, `it` |
| View own orders | Any authenticated user |
| Modify settings | `admin` |

**Approval and rejection must be scoped to the specific approver on the order.** A manager who is not the assigned `approver_id` must not be able to approve, even if they have a manager role.

---

## 7. Notifications

| Event | Recipient |
|-------|-----------|
| Order created | `approver_id` |
| Order approved | Requester |
| Order rejected | Requester |
| Order delivered | Requester |

Each event must trigger exactly one notification. Duplicate notifications caused by re-renders, retries, or auth refreshes are a known risk and must be guarded against (idempotency key or status check before insert).

---

## 8. Email Rules

Emails are sent for the same events as notifications (see Section 7). Email sending is currently handled via Supabase Edge Functions.

Email and notification delivery are independent side effects. A failure in one must not silently suppress the other, and neither failure must silently pass as a successful order action.

---

## 9. System Invariants

These conditions **must always be true.** Any state that violates an invariant is a bug, regardless of how it occurred.

1. Every `orders` row has at least one corresponding `order_items` row.
2. Every non-auto-approved order has a non-null `approver_id` that references a valid user.
3. Order status always follows the permitted transition graph (Section 1).
4. Only the assigned `approver_id` may approve or reject a given order.
5. Only `admin` or `it` roles may transition an order to `delivered`.
6. Roles used in approval routing reflect server-verified values, not client-computed ones.

---

## 10. Known Security Risks

These are **current gaps** between intended behavior and implementation reality. They are listed here so that analysis tools and developers understand the delta — not because they represent acceptable design.

| Risk | Description | Severity |
|------|-------------|----------|
| Frontend approval routing | `resolveApprovalRouting()` runs in the browser and can be manipulated | Critical |
| Admin UI gating only | Admin sections are hidden in UI but not necessarily blocked at data layer | High |
| Domain restriction client-side | Allowed email domains enforced in `Login.tsx`, not at auth/RPC level | High |
| Multi-step order write | No transaction between `orders` and `order_items` inserts | High |
| Approver ID not verified server-side | Backend does not confirm that the acting user matches `approver_id` | High |

---

## 11. Required Backend Guarantees (Target State)

The following rules **should** be enforced server-side via RLS policies or RPC validation, not relying on frontend enforcement:

- Approve/reject: verify that `auth.uid() = approver_id` on the target order
- Deliver: verify that the acting user has `admin` or `it` role
- Order insert: use an RPC that atomically inserts `orders` + `order_items`
- Domain restriction: enforce at Edge Function or auth hook level
- Admin writes: RLS policies must restrict sensitive table writes to admin role
