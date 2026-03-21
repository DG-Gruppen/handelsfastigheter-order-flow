## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- Last Reviewed: 2026-03-21
- Evidence Scope: partial repo snapshot plus existing repo docs
- Confidence: medium
- Owner: DG Gruppen
- Update Triggers: auth/permission logic changes, Supabase enforcement changes, workflow changes

## Risk Register

### Risk: Frontend-heavy access control
- Status: Open
- Type: Conditional security risk
- Why tracked: Existing repo docs emphasize hooks, route guards, navigation gating, and direct client-side Supabase access; backend enforcement must be verified separately.

### Risk: Order workflow drift
- Status: Open
- Type: Data/workflow integrity risk
- Why tracked: Existing repo docs reference order creation, approval flow, and notifications/email side effects; transition enforcement must be checked end-to-end.

### Risk: Documentation drift
- Status: Open
- Type: Governance risk
- Why tracked: The repo already has a `docs` directory, but only part of the expanded v2.x structure is present.
