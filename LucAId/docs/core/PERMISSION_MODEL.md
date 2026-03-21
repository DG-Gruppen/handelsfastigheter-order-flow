## Metadata
- Repository: {{REPOSITORY}}
- System: {{SYSTEM_NAME}}
- Package Version: {{VERSION}}
- Last Reviewed: {{DATE}}
- Status: Draft
- Source of Truth: Yes — for permission sources, precedence order, and conflict resolution
- Depends On: `docs/SYSTEM_OVERVIEW.md`, `docs/core/ARCHITECTURE.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `docs/governance/KNOWN_RISKS.md`
- Owner: {{OWNER}}
- Update Triggers: role change, permission precedence change, module access change

---

## Purpose

This file defines how access decisions are made in this system. It answers: *"Who can do what, and how is that determined?"*

Use this file when evaluating any access-control finding. Do not infer permission behavior from frontend code alone — frontend visibility is not authorization.

---

## Roles

*List all roles and their capabilities.*

| Role | Description | Key permissions |
|------|-------------|-----------------|
| | | |

---

## Permission sources

*What mechanisms grant or deny access?*

1. *Example: Role assignments in `user_roles` table*
2. *Example: Group membership via `group_members`*
3. *Example: Module-level overrides in `module_permissions`*

---

## Precedence order

*When multiple permission sources apply, which wins?*

1. *(highest priority)*
2.
3. *(lowest priority / default)*

---

## Conflict resolution

*What happens when rules conflict?*

- *Example: Explicit deny overrides implicit allow*
- *Example: User-level permissions override group-level*

---

## Frontend vs backend enforcement

*Which checks are client-only (UI) and which are enforced server-side?*

| Check | Frontend | Backend | Notes |
|-------|----------|---------|-------|
| | | | |

> ⚠️ Frontend-only checks are UI conveniences, not security controls. All security-relevant checks must be in the backend column.

---

## Known gaps

*Access control weaknesses. Full entries in `governance/KNOWN_RISKS.md`.*
