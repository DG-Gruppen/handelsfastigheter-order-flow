## Metadata
- Repository: {{REPOSITORY}}
- System: {{SYSTEM_NAME}}
- Package Version: {{VERSION}}
- Last Reviewed: {{DATE}}
- Status: Draft
- Source of Truth: Yes — for open and resolved risks
- Depends On: `docs/core/ARCHITECTURE.md`, `docs/core/DOMAIN_RULES.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `.github/workflows/lucaid-audit.yml`
- Owner: {{OWNER}}
- Update Triggers: new risk identified, risk resolved, severity change, backend enforcement added

---

## Purpose

This is the risk register for this system. Every risk identified during AI analysis or code review should be recorded here.

**Cross-reference rule:** Every analysis finding must be checked against this file. If it matches an open risk, reference it. If it is new, add it.

---

## Risk template

```
### RISK-N: [Short title]
- **Severity:** Critical | High | Medium | Low
- **Status:** Open | Mitigated | Resolved
- **Area:** [Module or component]
- **Description:** What the risk is
- **Impact:** What happens if exploited or triggered
- **Mitigation:** Current partial mitigation (if any)
- **Resolution:** What would fully close this risk
- **Identified:** YYYY-MM-DD
- **Resolved:** YYYY-MM-DD (if applicable)
```

---

## Open risks

*Add entries using the template above.*

---

## Resolved risks

*Move entries here when resolved. Keep for historical reference.*
