## Metadata
- Repository: {{REPOSITORY}}
- System: {{SYSTEM_NAME}}
- Package Version: {{VERSION}}
- Last Reviewed: {{DATE}}
- Status: Draft
- Source of Truth: Yes — for workflow step sequences, failure points, and smoke tests
- Depends On: `docs/core/DOMAIN_RULES.md`, `docs/core/PERMISSION_MODEL.md`, `docs/core/ARCHITECTURE.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `docs/governance/KNOWN_RISKS.md`
- Owner: {{OWNER}}
- Update Triggers: workflow step change, approval flow change, new workflow added

---

## Purpose

This file maps the step-by-step execution of every major workflow. Use it to:
- Map analysis findings to specific workflow steps
- Identify where failures propagate
- Verify that domain rules are enforced at the right steps

**See also:**
- `docs/core/DOMAIN_RULES.md` — the rules each workflow must enforce
- `docs/core/PERMISSION_MODEL.md` — access checks at each step

---

## Workflow template

Use this structure for each workflow:

```
### WF-N: [Workflow name]

**Trigger:** What starts this workflow
**Actor:** Who initiates it
**Preconditions:** What must be true before it can start

| Step | Action | Actor | Enforcement | Failure mode |
|------|--------|-------|-------------|--------------|
| 1 | | | | |
| 2 | | | | |

**Postconditions:** What must be true when it completes successfully

**Smoke tests:**
- ST-N.1: [Test description] → Expected result
- ST-N.2: [Test description] → Expected result
```

---

## Workflows

*Add one section per major workflow using the template above.*

### WF-1: [Workflow name]

*Replace with actual workflow content.*

---

*Repeat WF-N for each workflow.*
