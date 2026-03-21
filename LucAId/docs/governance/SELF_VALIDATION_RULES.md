## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.6.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for LucAId package self-consistency rules and validation checks
- Depends On: `manifest.json`, `schema.json`, `docs/governance/DOC_OWNERSHIP_RULES.md`
- Used By: `.github/workflows/lucaid-audit.yml`, `tools/lucaid_validate.py`, package maintainers
- Owner: DG Gruppen
- Update Triggers: new doc added, manifest contract change, CI validation change, ownership rule change

---

## Purpose

This file defines how LucAId validates itself before it is used to validate the repository.

A package that contains stale paths, conflicting ownership claims, or mismatched control-plane files is not trustworthy enough to guide AI analysis. These rules exist to prevent LucAId from drifting away from the repository or from its own internal contracts.

---

## Validation layers

### Layer 1 — Control-plane integrity
Validate:

- `manifest.json` exists and is parseable
- `schema.json` exists and is parseable
- `VERSION` exists and matches `manifest.json` → `package.version`
- `docs/MASTER_PROMPT.md` and `docs/AUTO_AUDIT_PROMPT.md` exist and are distinct entry points

### Layer 2 — Document registry integrity
Validate:

- every `documents[*].path` in `manifest.json` exists
- every `documents[*].id` is unique
- every `verified_context[]` path exists
- every `impact_map[*].review_docs[]` path exists
- every dependency in `depends_on` resolves to a registered file or root control-plane file

### Layer 3 — Source-of-truth integrity
Validate:

- no two docs claim the same exact source-of-truth responsibility in conflicting ways
- `DOC_OWNERSHIP_RULES.md` does not contradict `manifest.json`
- prompt files do not redefine source-of-truth ownership

### Layer 4 — Metadata parity
Validate all governed markdown files for the presence of:

- Repository
- System
- Package Version
- Status
- Source of Truth
- Depends On
- Used By
- Owner
- Update Triggers

Package version in metadata must match `VERSION` and `manifest.json`.

### Layer 5 — Prompt and workflow sync
Validate:

- prompts reference `manifest.json`, not duplicated hard-coded control-plane lists
- GitHub Action reads impact and validation behavior from `manifest.json` or from LucAId tools driven by it
- `tools/lucaid_validate.py` and `tools/lucaid_plan.py` remain compatible with `schema.json`

---

## Failure classes

| Class | Meaning | Action |
|---|---|---|
| **BLOCKER** | Control-plane broken; package cannot be trusted | Fail CI immediately |
| **ERROR** | Package inconsistency likely to mislead AI | Fail CI |
| **WARNING** | Non-fatal drift or incomplete metadata | Allow CI but require follow-up |
| **INFO** | Advisory note only | Log only |

---

## Canonical rules

1. `manifest.json` is the single machine-readable control plane.
2. `schema.json` defines the allowed shape of `manifest.json`.
3. Human-facing docs may summarize, but must not silently override manifest-defined structure.
4. Prompt files may instruct how to use LucAId, but must not own source-of-truth allocation.
5. CI validation must run before docs-impact analysis.
6. Any file added to verified context must also be in the document registry.
7. Any new governed markdown file must include the full metadata block.
8. A renamed file is not valid until `manifest.json`, prompts, workflow tooling, and dependent docs are updated.
9. If validation fails, AI analysis should proceed only with explicit reduced-confidence labeling.

---

## Recommended validator outputs

### Summary
- package version
- total registered docs
- total verified-context docs
- total warnings/errors

### Per-error output
- rule id
- severity class
- file(s) involved
- message
- suggested fix

### Exit behavior
- BLOCKER / ERROR → exit non-zero
- WARNING / INFO only → exit zero

---

## Suggested future checks

- section-level contradiction detection between `DOMAIN_RULES.md` and `WORKFLOW_MAPS.md`
- stale example detection in prompts
- orphan glossary term detection
- unresolved risk references in architecture and workflow docs
