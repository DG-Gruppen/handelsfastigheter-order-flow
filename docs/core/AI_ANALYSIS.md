## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- Last Reviewed: 2026-03-21
- Evidence Scope: partial repo snapshot
- Confidence: medium
- Owner: DG Gruppen
- Update Triggers: package/runtime changes, auth model changes, Supabase integration changes

## Verified Context
Observed from the public repository snapshot:
- React + TypeScript + Vite frontend
- `src`, `public`, and `supabase` directories
- `supabase/functions` and `supabase/migrations`
- Existing repo docs in `/docs`
- Existing analysis-oriented docs mention hooks such as `useAuth`, `useModules`, `useNavSettings`, `useAdminAccess`, `useModulePermission`, route protection, order pages, and Supabase client integration

## Evidence Labels
- VERIFIED: directly observed in code or repository tree
- OBSERVED: supported by multiple repo artifacts/docs
- INFERRED: likely, but not directly confirmed in inspected code
- UNKNOWN: not verified

## Review Method
1. Map the user-visible flow.
2. Identify who should be allowed to perform each action.
3. Trace UI checks, hook checks, and route checks.
4. Verify whether server-side enforcement exists.
5. Distinguish workflow drift from security drift.

## Severity Rules
- Critical: confirmed unauthorized sensitive action or severe data corruption path
- High: likely authorization or workflow integrity issue with meaningful impact
- Medium: conditional enforcement gap, inconsistent state, repeated side effect, or significant maintainability risk
- Low: local correctness gap, weak guard, cleanup item
- Observation: architecture or design note without concrete defect proof
