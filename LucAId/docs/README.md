# LucAId

**A deterministic AI governance framework for software repositories.**

LucAId gives AI coding assistants (Claude Code, Cursor, Copilot, etc.) verified, structured context about your codebase — and validates that context stays accurate over time.

---

## What it does

- Provides AI tools with a structured, validated knowledge base about your system
- Enforces consistency between documentation and reality via CI validation (8 layers)
- Maps code changes to the docs that need review via a manifest-driven impact plan
- Posts validation results and review checklists directly to PRs

---

## Structure

```
lucaid/
├── manifest.json              # Control plane — single source of truth
├── schema.json                # Manifest contract and validation schema
├── VERSION                    # Package version
├── CHANGELOG.md               # Version history
├── docs/
│   ├── README.md              # This file
│   ├── MASTER_PROMPT.md       # Prompt for full codebase analysis
│   ├── AUTO_AUDIT_PROMPT.md   # Prompt for PR-scoped review
│   ├── SYSTEM_OVERVIEW.md     # ← Fill in: full system description
│   ├── core/
│   │   ├── AI_ANALYSIS.md     # ← Fill in: analysis method and priorities
│   │   ├── ARCHITECTURE.md    # ← Fill in: layers, trust boundaries
│   │   ├── DOMAIN_RULES.md    # ← Fill in: business rules per module
│   │   ├── PERMISSION_MODEL.md# ← Fill in: access control model
│   │   └── WORKFLOW_MAPS.md   # ← Fill in: step-by-step workflow maps
│   ├── governance/
│   │   ├── CHANGE_SAFETY_RULES.md  # How to propose changes safely
│   │   ├── DOC_OWNERSHIP_RULES.md  # Which file owns which facts
│   │   ├── KNOWN_RISKS.md          # ← Fill in: risk register
│   │   ├── REFACTOR_RULES.md       # When and how to refactor
│   │   └── SELF_VALIDATION_RULES.md# Package self-consistency spec
│   └── reference/
│       ├── CODEBASE_GLOSSARY.md    # ← Fill in: canonical term definitions
│       └── DATA_MODEL.md           # ← Fill in: DB schema and constraints
├── tools/
│   ├── lucaid_validate.py     # 8-layer validator (run locally or in CI)
│   └── lucaid_plan.py         # Impact plan generator
├── .github/workflows/
│   └── lucaid-audit.yml       # CI: validate + impact plan + PR comment
└── examples/
    └── shf-intra/             # Full reference implementation (React + Supabase)
```

---

## Getting started

### 1. Fill in your system docs

Files marked `← Fill in` above need project-specific content. Start with `SYSTEM_OVERVIEW.md` — it feeds everything else.

**Recommended:** Ask an AI assistant to analyze your repository and produce `SYSTEM_OVERVIEW.md`. Then use it to fill in the remaining docs. See the instructions block inside each skeleton file.

For a complete reference, see `examples/shf-intra/`.

### 2. Configure manifest.json

Open `manifest.json` and:
- Replace `{{REPOSITORY}}`, `{{SYSTEM_NAME}}`, `{{DATE}}` with your values
- Replace the `impact_map` pattern placeholders with regex patterns matching your project's file structure
- See `examples/shf-intra/manifest.json.example` for a fully populated reference

### 3. Run the validator

```bash
pip install jsonschema
python tools/lucaid_validate.py
```

A clean run produces `"ok": true` with zero ERRORs.

### 4. Add to CI

Copy `.github/workflows/lucaid-audit.yml` to your repository. It will:
- Validate the LucAId package on every PR
- Generate a manifest-driven impact plan for changed files
- Post results as a PR comment and GitHub Step Summary

---

## How AI tools use LucAId

**Full analysis:** Paste the contents of `docs/MASTER_PROMPT.md` as your system prompt, then load all docs in the specified order before asking for analysis.

**PR review:** Use `docs/AUTO_AUDIT_PROMPT.md`. The impact plan from CI tells you which docs to load for the specific changes in the PR.

---

## Validator quick reference

```bash
# Validate package
python tools/lucaid_validate.py

# Generate impact plan for a list of changed files
echo "src/hooks/useAuth.ts" > changed.txt
python tools/lucaid_plan.py changed.txt
```

Exit codes: `0` = ok or warnings only, `1` = errors, `2` = blocker (control plane broken).

---

## Version

See `VERSION` and `CHANGELOG.md`.
