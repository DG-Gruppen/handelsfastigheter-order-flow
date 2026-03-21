Review this pull request against the repo `DG-Gruppen/handelsfastigheter-order-flow`.

Focus on changed files first.
Then cross-check against:
- `/docs/core/AI_ANALYSIS.md`
- `/docs/core/DOMAIN_RULES.md`
- `/docs/core/PERMISSION_MODEL.md`
- `/docs/core/ARCHITECTURE.md`
- `/docs/core/WORKFLOW_MAPS.md`
- `/docs/governance/KNOWN_RISKS.md`

Output only:
1. Findings
2. Missing or outdated docs that should be updated
3. Minimal safe fixes
4. Confidence level

Escalation rules:
- If PR touches `src/hooks/**`, `ProtectedRoute`, auth, admin access, or module access, review permission docs.
- If PR touches order pages, approval flows, or notifications, review domain/workflow docs.
- If PR touches `supabase/functions/**` or `supabase/migrations/**`, verify whether frontend assumptions still match backend enforcement.
