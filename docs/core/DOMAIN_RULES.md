## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- Last Reviewed: 2026-03-21
- Evidence Scope: partial repo snapshot plus existing repo docs
- Confidence: medium
- Owner: DG Gruppen
- Update Triggers: order states, approval logic, actor roles, notifications/email side effects

## Authoritative Intent
This file defines the intended business rules for order and approval analysis.

## Core Domain Areas
- Authentication
- Roles and group-derived permissions
- Module access
- Navigation gating
- Order creation
- Order approval flow
- Admin actions
- Notifications and email side effects

## Expected Rule Shape
- Every sensitive action must have a defined actor and enforcement point.
- Order lifecycle transitions should be explicit.
- Approval and admin actions should not rely on UI visibility alone.
- Side effects such as notifications/emails should align with confirmed state transitions.

## Review Questions
- Who may create, approve, reject, update, or finalize an order?
- Can any state change occur without verified server-side checks?
- Do email/notification side effects follow a confirmed transaction boundary?
