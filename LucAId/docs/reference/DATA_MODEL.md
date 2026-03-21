## Metadata
- Repository: {{REPOSITORY}}
- System: {{SYSTEM_NAME}}
- Package Version: {{VERSION}}
- Last Reviewed: {{DATE}}
- Status: Draft
- Source of Truth: Yes — for DB table definitions, column contracts, enum values, and known data constraints
- Depends On: `docs/SYSTEM_OVERVIEW.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `docs/core/DOMAIN_RULES.md`, `docs/core/ARCHITECTURE.md`, `docs/governance/KNOWN_RISKS.md`, `docs/reference/CODEBASE_GLOSSARY.md`
- Owner: {{OWNER}}
- Update Triggers: new table, column added/removed/renamed, enum value added, constraint changed, RLS policy change

---

## Purpose

This file is the authoritative reference for the database model. It defines tables, column contracts, enum types, key relationships, and known data-layer constraints.

**This file does not own:** business rules (`core/DOMAIN_RULES.md`), permission precedence (`core/PERMISSION_MODEL.md`), or risk analysis (`governance/KNOWN_RISKS.md`). It owns the structural data facts those files reason about.

---

## Enum types

*List all application-level enum types and their allowed values.*

### `[enum_name]`
Used in: `[table.column]`

| Value | Description |
|-------|-------------|
| | |

---

## Tables

*One section per logical group of tables.*

### [Group name]

#### `[table_name]`
*One-line description.*

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid PK | No | gen_random_uuid() | |
| | | | | |

**Constraints:**
- *List NOT NULL constraints explicitly*
- *List FK constraints: `column` → `other_table.id`*
- *List unique constraints*
- *List check constraints*

**RLS policies:**
- *SELECT: who can read? (e.g. "authenticated users", "owner only", "role = admin")*
- *INSERT: who can insert?*
- *UPDATE: who can update? Which columns?*
- *DELETE: who can delete?*

**Enforcement gaps:**
- *List known gaps where RLS or constraints are weaker than the domain rules require*

---

## Key constraints summary

*A quick-reference table of the most important data-layer constraints and known risks.*

| Constraint | Table(s) | Risk level |
|-----------|---------|------------|
| | | |

Full risk entries in `governance/KNOWN_RISKS.md`.
