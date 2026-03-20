# Domain Rules – handelsfastigheter-order-flow

## Purpose
Definierar hur systemet SKA fungera.

Claude ska använda detta som ground truth.

---

# 1. Order Lifecycle

## States

- pending
- approved
- rejected
- delivered

## Rules

### pending
- väntar på godkännande
- kan godkännas eller avslås

### approved
- godkänd av approver
- kan levereras

### rejected
- terminal state
- kan ej ändras

### delivered
- terminal state
- endast admin/IT

---

# 2. Roles

## Core roles

- admin
- manager
- it
- staff
- user

---

# 3. Approval Rules

## Central logic

Defined in:

`resolveApprovalRouting(...)`

## CEO
- auto-approve alltid

## Manager/Admin
Kan:
- auto-approve
- kräva CEO
- kräva manager

## Staff/IT
- auto-approve om ingen chef

## Approver resolution

Prioritet:

1. CEO
2. Manager
3. Self (auto)

---

# 4. Permissions

## Layered system

- user_roles
- group_members
- module_permissions

## Rules

- Admin override → full access
- Owner → full access
- Permissions kan komma från:
  - user
  - group

---

# 5. Order Creation Rules

En order måste:
- ha minst 1 item
- ha requester_id
- ha approver_id

## Flow

1. Insert order
2. Insert items
3. Notify approver
4. Send email

## Critical Rule

Order + items = atomisk operation (bör vara)

Nu:
→ inte garanterat

---

# 6. Approval Rules

## Approve
Endast:
- approver_id

## Reject
Endast:
- approver_id

## Deliver
Endast:
- admin / IT

---

# 7. Notifications

Triggers:

- new order → approver
- approved → requester
- rejected → requester
- delivered → requester

---

# 8. Email Rules

Emails skickas:

- vid approval request
- vid approval
- vid rejection
- vid delivery

---

# 9. Security Assumptions

Systemet antar:

- frontend inte manipuleras
- roles är korrekta
- approver_id är trusted

Detta är **inte säkert utan backend enforcement**

---

# 10. Critical Risks

## 1. Approval bypass
Frontend kan manipuleras

## 2. Admin access
UI-only restriction

## 3. Order integrity
Multi-step writes

## 4. Domain restriction
Frontend only

---

# 11. Required Guarantees (SHOULD)

Systemet bör säkerställa:

- approver matchar user vid approve
- admin krävs för deliver
- order + items atomiskt
- roles verifieras server-side

---

# 12. Invariants

MÅSTE alltid vara sant:

- order har minst 1 item
- approver_id är korrekt
- status följer lifecycle
- endast rätt user får ändra status
