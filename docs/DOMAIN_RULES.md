# DOMAIN_RULES_v2

## Purpose
This file defines the intended business rules for `handelsfastigheter-order-flow`, and separates them from observed current implementation.

Claude Code must not confuse:
- intended domain rule
- current frontend behavior
- unverified backend enforcement

---

## Reading Convention
Each critical rule should be analyzed using:

- **Intended Rule** — how the system is supposed to behave
- **Observed Implementation** — what the inspected frontend currently does
- **Backend Enforcement Status** — verified / unclear / not visible
- **Risk If Missing** — what can go wrong

---

# 1. Core Actors

## Actor types
- requester
- recipient
- approver
- admin
- IT
- manager
- regular user
- staff

### Intended meaning
- **requester** = the authenticated user creating the order
- **recipient** = the person the equipment/order is for
- **approver** = the person who must approve or reject the order
- **admin** = system-wide elevated access
- **IT** = operational elevated access, especially around delivery and support
- **manager** = role used in approval chains
- **staff** = special employee type affecting approval routing

---

# 2. Order Lifecycle

## Allowed states
- `pending`
- `approved`
- `rejected`
- `delivered`

## Intended lifecycle
- `pending -> approved`
- `pending -> rejected`
- `approved -> delivered`

## Forbidden transitions
- `rejected -> *`
- `delivered -> *`
- `approved -> pending`
- `approved -> rejected`
- `pending -> delivered`

### Observed implementation
Frontend clearly uses:
- approve from pending
- reject from pending
- deliver from approved

### Backend enforcement status
Not visible.

### Risk if missing
A crafted client or weak policy could force illegal transitions.

---

# 3. Transition Authority Rules

## Rule A: Approve
### Intended Rule
Only the assigned `approver_id` may approve a pending order.

### Observed Implementation
`OrderDetail.tsx` derives `canApprove` from:
- `order.status === "pending"`
- `order.approver_id === user?.id`

The update itself appears to filter by order id only.

### Backend Enforcement Status
Not visible.

### Risk If Missing
Approval could be performed by another authenticated user if backend policy is weak.

---

## Rule B: Reject
### Intended Rule
Only the assigned `approver_id` may reject a pending order.

### Observed Implementation
Reject action is exposed through the same UI area as approval, but the update path still appears to target by order id only.

### Backend Enforcement Status
Not visible.

### Risk If Missing
Unauthorized rejection or altered rejection reason.

---

## Rule C: Deliver
### Intended Rule
Only `admin` or `it` should be able to transition an approved order to `delivered`.

### Observed Implementation
Frontend shows delivery action for admin-like access.

### Backend Enforcement Status
Not visible.

### Risk If Missing
Unauthorized fulfillment or false delivery marking.

---

# 4. Order Creation Rules

## Rule A: Minimum valid order
### Intended Rule
An order must:
- have a requester
- have at least one valid item
- resolve an approver or valid auto-approval path
- have a valid lifecycle starting state

### Observed Implementation
`NewOrder.tsx` validates:
- at least one selected item
- current user exists
- non-privileged user has manager profile unless privileged logic applies

### Backend Enforcement Status
Unclear.

### Risk If Missing
Malformed orders or orphaned rows.

---

## Rule B: Order and items should be atomic
### Intended Rule
`orders` and `order_items` should succeed or fail together.

### Observed Implementation
Frontend inserts `orders`, then inserts `order_items`, then deletes the order on item failure.

### Backend Enforcement Status
No transaction visible.

### Risk If Missing
Partial writes, orphaned rows, or rollback gaps if later side effects fail.

---

## Rule C: Side effects are secondary
### Intended Rule
Core order persistence should be authoritative.
Notifications and emails should not determine whether the order exists.

### Observed Implementation
Order creation succeeds before several notification/email steps run.

### Backend Enforcement Status
Not applicable at frontend level.

### Risk If Missing
Users may see created orders without expected notifications, or duplicate messages if retries occur.

---

# 5. Approval Routing Rules

## Intended Rule
Approver routing must be deterministic and based on trusted org data.

## Observed Implementation
Frontend helper `resolveApprovalRouting(...)` decides:
- auto approval
- CEO approval
- manager approval
- resolved approver id

Observed factors:
- whether user is CEO
- whether user is manager/admin
- whether user is IT
- whether user is staff
- whether user reports directly to CEO
- approval settings
- manager profile existence

### Backend Enforcement Status
Not visible.

### Risk If Missing
Browser-side manipulation or logic drift may produce wrong approver assignment.

---

## Specific routing intentions

### CEO
- always auto-approved

### IT / Staff without manager
- auto-approved

### Manager/Admin reporting directly to CEO
- may require CEO approval depending on settings

### Manager/Admin not directly under CEO
- may require manager approval if manager exists

### Fallback expectation
- approver resolution should never silently produce an invalid authority state

---

# 6. Permission Model

## Permission sources observed
- `user_roles`
- `group_members`
- group-derived `role_equivalent`
- `module_role_access`
- `module_permissions`
- `useAdminAccess`
- `useModulePermission`

## Intended Rule
Permission precedence must be deterministic.

## Recommended precedence model
1. hard backend deny
2. admin override
3. explicit owner
4. explicit user permission
5. explicit group permission
6. role-based module access
7. fallback default

### Observed Implementation
Frontend appears to combine:
- merged roles
- explicit module permissions
- group permissions
- role-based fallbacks
- special admin/IT behavior

### Backend Enforcement Status
Not visible.

### Risk If Missing
Privilege drift, inconsistent UI, or mismatched access between pages.

---

# 7. Admin Rules

## Intended Rule
Seeing an admin section is not the same as being authorized to mutate its data.

## Observed Implementation
Admin visibility is derived through `useAdminAccess` and hardcoded section mappings.

### Backend Enforcement Status
Not visible.

### Risk If Missing
Hidden-but-reachable or visible-but-not-authorized behavior.

---

# 8. Navigation Rules

## Intended Rule
Disabled navigation should reflect true system policy, not just visual hiding.

## Observed Implementation
`useNavSettings.tsx` maps routes to org setting keys and disables routes in frontend logic.

### Backend Enforcement Status
Not visible.

### Risk If Missing
Direct URL access may bypass intended route disablement.

---

# 9. Login / Identity Domain Rules

## Rule A: Domain restrictions
### Intended Rule
Restricted domains should be enforced as security policy if they are part of trust assumptions.

### Observed Implementation
`Login.tsx` checks allowed domains in browser logic for email auth and passes Google Workspace hinting.

### Backend Enforcement Status
Not visible.

### Risk If Missing
Browser-only restriction may give false confidence.

---

## Rule B: Profile and role completeness
### Intended Rule
A signed-in user should have a resolvable profile and deterministic role set before sensitive decisions are made.

### Observed Implementation
Frontend fetches profile and roles after auth state changes.

### Backend Enforcement Status
Not applicable directly.

### Risk If Missing
Incorrect access decisions during partial load or fetch failure.

---

# 10. Notification and Email Rules

## Intended Rule
Notifications and emails should mirror state transitions, not define them.

## Expected triggers
- new pending order -> approver notified
- approved order -> requester notified
- rejected order -> requester notified
- delivered order -> requester notified

### Observed Implementation
Frontend triggers these side effects after state changes.

### Backend Enforcement Status
Not visible for authorization; implementation visible only partly.

### Risk If Missing
Duplicate or missing communications without state rollback.

---

# 11. Invariants

These should always be true:

1. every order has at least one item
2. every pending order has a valid approver unless explicitly auto-approved
3. only allowed actors can perform lifecycle transitions
4. status transitions follow the allowed lifecycle
5. recipient and requester semantics remain distinct
6. permission precedence is deterministic
7. admin visibility does not substitute for backend authorization

---

# 12. What Claude Should Flag

Flag as **High** when:
- a sensitive transition updates only by `id`
- frontend-only checks enforce authority
- approval routing depends solely on browser logic
- order creation can leave inconsistent state

Flag as **Medium** when:
- permission precedence is ambiguous
- route disablement is only visual
- notification/email behavior can drift from order state

Flag as **Observation** when:
- rules are duplicated across hooks
- mappings are hardcoded in multiple places
- architecture could be clarified without immediate correctness risk

---

# 13. Final Interpretation Rule
When analyzing this repo, Claude must prefer this reasoning style:

- first identify the intended domain rule
- then compare observed implementation
- then state whether backend enforcement is verified
- then assess risk

Never treat current frontend behavior as proof that the business rule is safely enforced.
