# Changelog

All versions of the `LucAId` package for `DG-Gruppen/handelsfastigheter-order-flow` (SHF Intra).

---

## [3.6.0] — 2026-03-21

### Added
- `manifest.json` → `fix_templates` — 26 deterministiska fix-templates, en per `rule_id`. Validator läser dessa istället för att generera fria textsträngar per finding.
- `tools/lucaid_discover.py` — auto-discovery av routes, DB-tabeller, backend-funktioner och auth-filer från faktisk repo-struktur. Genererar föreslagna `impact_map`-entries som JSON. Bootstrappar manifest utan manuellt skrivna regex.
- `priority_score` per finding i validator-output — beräknat som `severity_weight + verified_context_bonus + ci_blocking_bonus`. Findings sorteras efter `priority_score` descending.
- `docs/reference/DATA_MODEL.md` skelett utökat med `Nullable`, `Default`, och separata **RLS policies** + **Enforcement gaps** sektioner per tabell.
- `docs/QUICKSTART.md` — nytt Steg 4 beskriver hur `lucaid_discover.py` används för att auto-generera `impact_map`.

### Changed
- `tools/lucaid_validate.py` — `suggested_fix` per finding läses nu från `manifest.json → fix_templates[rule_id]` (deterministisk) istället för inline-strängar. Output inkluderar `findings` count och `priority_score` per result.
- `manifest.json` — `registered_docs` nu 22.
- `schema.json` → `entry_points` tillåter nu `additionalProperties` (quickstart m.fl.).
- Alla metadata Package Version bumpad till 3.6.0.
- `VERSION` bumpad till 3.6.0.

---

## [3.5.0] — 2026-03-21

### Breaking change — multi-repo / generic framework

LucAId is now a portable framework, not a project-specific package. The SHF Intra content has been moved to an example layer.

### Added
- `examples/shf-intra/` — full reference implementation of LucAId for SHF Intra (DG-Gruppen/handelsfastigheter-order-flow). Contains all project-specific docs from v3.4: SYSTEM_OVERVIEW, AI_ANALYSIS, ARCHITECTURE, DOMAIN_RULES, PERMISSION_MODEL, WORKFLOW_MAPS, KNOWN_RISKS, DATA_MODEL, CODEBASE_GLOSSARY.
- `examples/shf-intra/README.md` — explains the example and how to adapt it.
- `examples/shf-intra/manifest.json.example` — fully populated manifest reference for a React + Supabase project.
- Skeleton docs in `docs/` — every project-specific doc replaced with a structured template with `{{PLACEHOLDER}}` fields and fill-in instructions.

### Changed
- `docs/SYSTEM_OVERVIEW.md` → generic skeleton with generation instructions.
- `docs/core/AI_ANALYSIS.md` → generic skeleton.
- `docs/core/ARCHITECTURE.md` → generic skeleton.
- `docs/core/DOMAIN_RULES.md` → generic skeleton.
- `docs/core/PERMISSION_MODEL.md` → generic skeleton.
- `docs/core/WORKFLOW_MAPS.md` → generic skeleton.
- `docs/governance/KNOWN_RISKS.md` → generic skeleton.
- `docs/reference/DATA_MODEL.md` → generic skeleton.
- `docs/reference/CODEBASE_GLOSSARY.md` → generic skeleton.
- `docs/MASTER_PROMPT.md` → generalized; no SHF Intra or stack-specific references.
- `docs/AUTO_AUDIT_PROMPT.md` → generalized.
- `docs/README.md` → rewritten as a framework installation guide.
- `manifest.json` → `impact_map` replaced with generic placeholder patterns; `package.repository` and `package.system` set to `{{PLACEHOLDER}}` values.
- `schema.json` → `generated_at` and `version` patterns relaxed to accept `{{PLACEHOLDER}}` strings (enables validation of unconfigured packages without false positives).

### No changes
- `tools/lucaid_validate.py` — already generic.
- `tools/lucaid_plan.py` — already generic.
- `docs/governance/CHANGE_SAFETY_RULES.md`, `DOC_OWNERSHIP_RULES.md`, `REFACTOR_RULES.md`, `SELF_VALIDATION_RULES.md` — already generic.
- `.github/workflows/lucaid-audit.yml` — already generic.

---

## [3.4.0] — 2026-03-21

### Added
- `docs/reference/DATA_MODEL.md` — authoritative DB table reference with enum definitions, column contracts, key constraints, and a risk summary table. Registered as source-of-truth for `data-model` role.
- `tools/lucaid_validate.py` — fully rewritten with 8 validation layers:
  - Layer 2: schema enforcement via `jsonschema` (manifest validated against `schema.json` in CI)
  - Layer 7: enum conformance (severity in KNOWN_RISKS, escalation in CHANGE_SAFETY_RULES checked against `manifest.conventions`)
  - Layer 8: cross-doc validation — glossary coverage (WORKFLOW_MAPS identifiers → CODEBASE_GLOSSARY), risk-ID resolution (refs in all docs → KNOWN_RISKS), impact_map area coverage (manifest areas → DOMAIN_RULES sections)
- GitHub Action — new `post-pr-comment` job posts combined validation + impact plan as a PR comment (creates or updates existing); both Step Summary and PR comment now produced.
- `manifest.json` — `self_validation.rules` expanded to 15 rules; `self_validation.validation_layers: 8`; DATA_MODEL added to `verified_context`, `documents[]`, and `system_docs` impact area.

### Changed
- `manifest.json` — `verified_context` now 13 files (added DATA_MODEL).
- `manifest.json` — `registered_docs` now 20.
- GitHub Action — `install dependencies` step added (`pip install jsonschema`) to support schema enforcement layer.
- All metadata Package Version fields bumped to 3.4.0.
- `VERSION` bumped to 3.4.0.

---

## [3.3.0] — 2026-03-21

### Fixed
- CHANGELOG de-duplicated and corrected (v3.2 contained two conflicting entries).
- `docs/SYSTEM_OVERVIEW.md` — added missing metadata fields: System, Source of Truth, Depends On, Used By, Owner, Update Triggers.
- `docs/MASTER_PROMPT.md` — added `## Metadata` block.
- `docs/AUTO_AUDIT_PROMPT.md` — added `## Metadata` block.
- `tools/lucaid_validate.py` — metadata block check now only applies to `verified_context` docs, not CHANGELOG or README.
- `schema.json` — removed hard `const: "LucAId"` on `package.name`; replaced with `type: string` to allow reuse across projects.

### Changed
- `MANIFEST.json` → `manifest.json` rename from v3.2 now documented explicitly.
- All metadata Package Version fields bumped to 3.3.0.
- `VERSION` bumped to 3.3.0.

---

## [3.2.0] — 2026-03-21

### Added
- `manifest.json` promoted to machine-readable control plane with `impact_map`, `self_validation`, `conventions`, `entry_points`, and full `depends_on`/`used_by` chains per file.
- `schema.json` — defines the manifest contract, enums, and validation expectations.
- `docs/governance/SELF_VALIDATION_RULES.md` — spec for package self-consistency checks.
- `tools/lucaid_validate.py` — CI and local validator driven by `manifest.json`.
- `tools/lucaid_plan.py` — changed-file impact analysis driven by `manifest.json`.
- GitHub Action upgraded: `validate-lucaid` job runs before `docs-impact-check`; impact job blocked on validation failure.

### Changed
- `MANIFEST.json` renamed to `manifest.json` (lowercase). Breaking change on case-sensitive filesystems — update any references accordingly.
- `docs/MASTER_PROMPT.md` and `docs/AUTO_AUDIT_PROMPT.md` updated to treat `manifest.json` as the single control plane.
- `docs/core/AI_ANALYSIS.md` — verified context is now manifest-driven.

---

## [3.1.0] — 2026-03-21

### Added
- `MANIFEST.json` — single source of truth for package structure, file roles, `verified_context` list, and `source_of_truth_for` declarations per file.
- `docs/SYSTEM_OVERVIEW.md` — added `Package Version` and `Status` to metadata block.

### Changed
- `MASTER_PROMPT.md` — load order references MANIFEST.json as authoritative; `DOC_OWNERSHIP_RULES.md` added to load order; order aligned with `verified_context`.
- `AUTO_AUDIT_PROMPT.md` — MANIFEST.json declared as tie-breaker if prompt and manifest diverge.
- `VERSION` bumped to 3.1.0.
- All metadata Package Version fields bumped to 3.1.0.

---

## [3.0.0] — 2026-03-21

### Breaking change — full rebuild from SYSTEM_OVERVIEW.md

v2.x described only the order flow subsystem. v3.0 is a complete rebuild covering the entire SHF Intra platform based on full codebase analysis via SYSTEM_OVERVIEW.md.

- `DOMAIN_RULES.md` expanded to full system domain rules covering all 17 modules.
- `WORKFLOW_MAPS.md` expanded from 8 order-focused workflows to 14 full-system workflows.
- `KNOWN_RISKS.md` rebuilt as full risk register across all modules.
- `ARCHITECTURE.md` rebuilt to cover pgmq, pg_cron, dual content indexing, impersonation, and encryption layer.
- `CODEBASE_GLOSSARY.md` expanded to all modules, tables, and system-specific terms.
- `AI_ANALYSIS.md` expanded hotspots and anti-patterns to all modules.
- All metadata blocks standardized.
- `DOC_OWNERSHIP_RULES.md`, `CHANGE_SAFETY_RULES.md`, `REFACTOR_RULES.md` retained and updated.
- `SYSTEM_OVERVIEW.md` added as a tracked file in the package.
- GitHub Action updated for full system.

---

## [2.5.0] — 2026-03-21

Structural cleanup of v2.4. Separated MASTER_PROMPT and AUTO_AUDIT_PROMPT. Added DOC_OWNERSHIP_RULES.md, standardized metadata, added resolved risk format, standardized workflow template, improved GitHub Action.

---

## [2.4.0] — 2026-03-21

Initial release. Order-flow-focused documentation package.
