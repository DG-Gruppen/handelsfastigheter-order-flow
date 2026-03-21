## Metadata
- Repository: {{REPOSITORY}}
- System: {{SYSTEM_NAME}}
- Package Version: {{VERSION}}
- Last Reviewed: {{DATE}}
- Status: Draft
- Source of Truth: Yes — for system purpose, module inventory, user roles, DB tables, edge functions, and integrations
- Depends On: *(none — generated from codebase)*
- Used By: `docs/MASTER_PROMPT.md`, `docs/core/AI_ANALYSIS.md`, `docs/core/ARCHITECTURE.md`, `docs/core/DOMAIN_RULES.md`, `docs/core/PERMISSION_MODEL.md`, `docs/reference/CODEBASE_GLOSSARY.md`
- Owner: {{OWNER}}
- Update Triggers: new module, new route, new DB table, integration change, role change

---

## Instructions

This file is the entry point for AI analysis of this system. It should be generated or written once per project and kept up to date as the system evolves.

**Recommended approach:** Ask an AI assistant to analyze the full codebase and produce this document. Provide the following prompt:

> "Analyze this repository and produce a SYSTEM_OVERVIEW.md covering: (1) system purpose, (2) user roles and permissions, (3) modules/feature areas with routes and DB tables, (4) navigation structure, (5) all database tables with key columns and relationships, (6) backend functions/services, (7) shared utilities, (8) integration points, (9) known complexity areas, (10) what this system is NOT."

Replace this instructions block with the generated content before using LucAId.

---

## 1. System purpose

*Describe what this system does, who uses it, and what problem it solves.*

---

## 2. User roles

*List all roles, their descriptions, and key permissions.*

| Role | Description | Key permissions |
|------|-------------|-----------------|
| | | |

---

## 3. Modules and feature areas

*List all modules/features with routes, access control, and DB tables.*

| Module | Route | Purpose | Access | DB tables |
|--------|-------|---------|--------|-----------|
| | | | | |

---

## 4. Database tables

*List all tables with key columns and relationships. See also `docs/reference/DATA_MODEL.md` for full detail.*

---

## 5. Backend functions / services

*List all backend functions, edge functions, or services.*

---

## 6. Integration points

*External services, APIs, and integrations.*

---

## 7. Known complexity areas

*Areas of the codebase that require extra care during analysis.*

---

## 8. What this system is NOT

*Explicit scope boundaries to prevent AI from making incorrect assumptions.*
