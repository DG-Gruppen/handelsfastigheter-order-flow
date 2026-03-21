## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.7.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for documentation governance and ownership
- Depends On: —
- Used By: All docs files, GitHub Action, AI analysis tools
- Owner: DG Gruppen
- Update Triggers: new docs file added, file renamed or split, ownership of a rule changes

---

## Purpose

Defines which file owns which rules, what may be duplicated, what must be linked, and how conflicts are resolved. Consult before editing any doc.

---

## Ownership map

| Rule or concern | Owner | May reference | Must NOT redefine |
|---|---|---|---|
| All business rules and invariants | `core/DOMAIN_RULES.md` | All files | `WORKFLOW_MAPS.md`, `KNOWN_RISKS.md`, `AI_ANALYSIS.md`, `ARCHITECTURE.md` |
| Permission precedence and conflict rules | `core/PERMISSION_MODEL.md` | `AI_ANALYSIS.md`, `ARCHITECTURE.md`, `KNOWN_RISKS.md` | `AI_ANALYSIS.md`, `KNOWN_RISKS.md` |
| System layers, data flows, trust boundaries | `core/ARCHITECTURE.md` | `AI_ANALYSIS.md`, `WORKFLOW_MAPS.md` | `KNOWN_RISKS.md`, `DOMAIN_RULES.md` |
| Workflow sequences and failure points | `core/WORKFLOW_MAPS.md` | `KNOWN_RISKS.md`, `AI_ANALYSIS.md` | May not redefine rules from `DOMAIN_RULES.md` |
| Analysis method and output format | `core/AI_ANALYSIS.md` | All files | May not own domain rules or risks |
| Open and resolved risk entries | `governance/KNOWN_RISKS.md` | `AI_ANALYSIS.md`, `CHANGE_SAFETY_RULES.md` | May not redefine rules; reference `DOMAIN_RULES.md` by section |
| Change safety constraints | `governance/CHANGE_SAFETY_RULES.md` | All files | May not redefine permission or domain rules |
| Refactor guidance | `governance/REFACTOR_RULES.md` | `CHANGE_SAFETY_RULES.md` | May not redefine architecture |
| Canonical term definitions | `reference/CODEBASE_GLOSSARY.md` | All files | Must stay aligned with `DOMAIN_RULES.md` and `PERMISSION_MODEL.md` |
| Full system structural description | `docs/SYSTEM_OVERVIEW.md` | All files | Authoritative for structural facts (what exists); not authoritative for rules |
| Documentation governance | `governance/DOC_OWNERSHIP_RULES.md` (this file) | README, GitHub Action | — |
| Machine load order and constraints | `docs/MASTER_PROMPT.md` | — | Must not contain domain rules |
| PR audit instructions | `docs/AUTO_AUDIT_PROMPT.md` | — | Must not contain domain rules |

---

## What may be duplicated

The following appear in more than one file intentionally:

- **Risk severity labels** — in both `KNOWN_RISKS.md` and `DOMAIN_RULES.md` §17. Both must stay in sync. `KNOWN_RISKS.md` is authoritative for status; `DOMAIN_RULES.md` §17 is a pointer table only.
- **Workflow failure points** — in both `WORKFLOW_MAPS.md` and `KNOWN_RISKS.md`. `WORKFLOW_MAPS.md` owns step context; `KNOWN_RISKS.md` owns the risk entry.
- **Layer descriptions** — `ARCHITECTURE.md` owns the layer model. `AI_ANALYSIS.md` may summarize layers for analytical context but must not extend or redefine them.
- **Structural facts from SYSTEM_OVERVIEW.md** — other files may reference module names, routes, and table names from SYSTEM_OVERVIEW without reproducing the full descriptions.

---

## What must be linked, not copied

- Business invariants (`DOMAIN_RULES.md` §16) — reference by section number only
- Permission precedence order (`PERMISSION_MODEL.md`) — reference, do not restate
- Canonical term definitions (`CODEBASE_GLOSSARY.md`) — reference the glossary term
- Risk entries (`KNOWN_RISKS.md`) — reference by risk name, do not copy the full entry

---

## SYSTEM_OVERVIEW.md special rules

`docs/SYSTEM_OVERVIEW.md` is generated and maintained by Lovable, not manually edited. It is authoritative for structural facts (which modules exist, which routes exist, which tables exist, which edge functions exist). It is **not** authoritative for business rules or permission models — those belong to `core/DOMAIN_RULES.md` and `core/PERMISSION_MODEL.md`.

If `SYSTEM_OVERVIEW.md` and a core doc diverge:
- If it's a structural fact (e.g. a new table exists) → update the core doc to reflect the new structure
- If it's a rule (e.g. who can access something) → the core doc wins; `SYSTEM_OVERVIEW.md` may be inaccurate on rules

---

## Conflict resolution

1. Identify the owner per the Ownership Map above.
2. The owner's version is correct.
3. The non-owner file must be updated to align.
4. If the conflict suggests the owner is wrong, update the owner first, then cascade.
5. Document the correction in `CHANGELOG.md`.

---

## Adding a new docs file

1. Define ownership scope in this file's Ownership Map.
2. Define what it may reference and may not redefine.
3. Add to `docs/README.md` folder map.
4. Add to `MASTER_PROMPT.md` load order if relevant for full analysis.
5. Add appropriate trigger to `lucaid-audit.yml`.
6. Add `CHANGELOG.md` entry.

---

## Renaming or splitting a file

1. Update all `See also` cross-references in other docs.
2. Update Ownership Map in this file.
3. Update `MASTER_PROMPT.md` load order.
4. Update `AUTO_AUDIT_PROMPT.md` doc selection table.
5. Update GitHub Action path→doc config block.
6. Update `AI_ANALYSIS.md` Verified Context list if source files affected.
7. Add `CHANGELOG.md` entry.


---

## Manifest-driven governance

`manifest.json` is the machine-readable registry of LucAId files, dependencies, and impact rules. This document remains the human-readable policy layer. If this file and `manifest.json` diverge on structure or ownership mapping, update both in the same change set.
