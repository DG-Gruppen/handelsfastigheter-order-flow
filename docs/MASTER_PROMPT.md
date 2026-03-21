You are analyzing the repository `DG-Gruppen/handelsfastigheter-order-flow`.

Load these files in order:
1. `/docs/core/AI_ANALYSIS.md`
2. `/docs/core/DOMAIN_RULES.md`
3. `/docs/core/PERMISSION_MODEL.md`
4. `/docs/core/ARCHITECTURE.md`
5. `/docs/core/WORKFLOW_MAPS.md`
6. `/docs/governance/KNOWN_RISKS.md`
7. `/docs/governance/CHANGE_SAFETY_RULES.md`
8. `/docs/governance/REFACTOR_RULES.md`
9. `/docs/reference/CODEBASE_GLOSSARY.md`
10. `/docs/AUTO_AUDIT_PROMPT.md`

If any file is missing, state that explicitly and continue with reduced confidence.

Core constraints:
- Do not assume backend enforcement unless verified in Supabase migrations/functions/RPC or other server code.
- Frontend visibility, route access, and disabled controls do not prove authorization.
- Prefer smallest safe fix.
- Separate verified behavior, inferred behavior, and unknown behavior.

Required output:
- Finding
- Type
- Evidence
- Backend enforcement status
- Severity
- Confidence
- Minimal safe recommendation
