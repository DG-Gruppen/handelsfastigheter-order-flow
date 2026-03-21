## Metadata
- Repository: {{REPOSITORY}}
- System: {{SYSTEM_NAME}}
- Package Version: {{VERSION}}
- Last Reviewed: {{DATE}}
- Status: Draft
- Source of Truth: Yes — for business rules and intended behavior per module. When a rule appears in multiple files, this file wins.
- Depends On: `docs/SYSTEM_OVERVIEW.md`
- Used By: `docs/core/WORKFLOW_MAPS.md`, `docs/governance/KNOWN_RISKS.md`
- Owner: {{OWNER}}
- Update Triggers: business rule changes, module behavior change, lifecycle change

---

## Purpose

This file is the authoritative source for intended business behavior. It answers: *"What is this system supposed to do?"*

Use this file to evaluate whether a finding is a real bug (violates intended behavior) or a legitimate design choice.

**See also:**
- `docs/core/WORKFLOW_MAPS.md` — step-by-step maps of how rules are executed
- `docs/core/PERMISSION_MODEL.md` — how access rules are resolved
- `docs/reference/DATA_MODEL.md` — data constraints that enforce rules

---

## Global invariants

*Rules that apply across all modules. These must never be violated.*

1. *Example: All state-changing operations must be authenticated.*
2. *Example: Users may only modify data they own or are explicitly authorized to modify.*

---

## Module rules

*Add one section per module. For each module, list the rules that govern its behavior.*

---

### §1 [Module name]

**Purpose:** *What does this module do?*

**Rules:**
1. *Rule description*
2. *Rule description*

**Lifecycle / states:** *(if applicable)*

| State | Meaning | Valid transitions |
|-------|---------|------------------|
| | | |

**Enforcement:** *Where are these rules enforced — client, API, DB?*

---

*Repeat §N for each module.*
