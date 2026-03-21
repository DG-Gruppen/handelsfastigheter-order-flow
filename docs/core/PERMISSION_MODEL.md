## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- Last Reviewed: 2026-03-21
- Evidence Scope: partial repo snapshot plus existing repo docs
- Confidence: medium
- Owner: DG Gruppen
- Update Triggers: auth hooks, admin access logic, protected routes, module access logic

## Purpose
Normalize access-control reasoning across the repo.

## Observed Inputs
Existing repo docs reference:
- role and group-derived permissions
- module access
- navigation gating
- hooks such as `useAuth`, `useModules`, `useNavSettings`, `useAdminAccess`, `useModulePermission`
- `ProtectedRoute`

## Analysis Rules
- A visible button is not authorization.
- A route guard is not final authorization.
- Hook-computed access is frontend evidence only unless matched by server enforcement.
- If multiple permission sources exist, document precedence explicitly.

## Recommended Precedence Model
1. explicit deny
2. explicit allow
3. role/group/module-derived allow
4. UI convenience flags

## Conflict Examples
- Route allows page render, but server mutation is unverified → conditional security risk
- Admin navigation visible, but admin mutation path lacks server check → high-risk candidate if mutation is sensitive
