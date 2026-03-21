## Metadata
- Repository: {{REPOSITORY}}
- System: {{SYSTEM_NAME}}
- Package Version: {{VERSION}}
- Last Reviewed: {{DATE}}
- Status: Active
- Source of Truth: No — prompt instructions only; manifest.json owns impact map and file roles
- Depends On: `manifest.json`, `docs/governance/CHANGE_SAFETY_RULES.md`
- Used By: PR review automation
- Owner: {{OWNER}}
- Update Triggers: impact map change, PR review policy change, new module area

---

Review this pull request against **{{SYSTEM_NAME}}** (`{{REPOSITORY}}`).

This is a PR-scoped audit. Load only the docs flagged by the changed files below. Always load `docs/governance/CHANGE_SAFETY_RULES.md` regardless of what changed.

The canonical file list and impact map are defined in `manifest.json`. If this prompt and `manifest.json` diverge, `manifest.json` wins.

Do not load `docs/core/AI_ANALYSIS.md` Priority 6 (Maintainability) unless the PR explicitly targets a refactor.

---

## Step 1 — Identify changed files

List all changed files and group by area using the `impact_map` in `manifest.json`.

---

## Step 2 — Select docs to load

Use `manifest.json` → `impact_map` to determine which docs to load for each changed area.

Always load: `docs/governance/CHANGE_SAFETY_RULES.md`

---

## Step 3 — Analyze changed files

For each changed file:

1. Identify what the change does.
2. Check whether it touches a high-risk area (`governance/KNOWN_RISKS.md`, `governance/CHANGE_SAFETY_RULES.md`).
3. Verify whether it preserves domain invariants (`core/DOMAIN_RULES.md`).
4. Check whether any frontend assumption is inconsistent with known backend enforcement.
5. If the PR touches backend migrations or functions: state explicitly whether it closes, widens, or is unrelated to any open risk in `governance/KNOWN_RISKS.md`.

---

## Step 4 — Output

**Findings** — using the format from `MASTER_PROMPT.md`. Include only findings related to changed files or their dependencies.

**Summary** — one paragraph: what changed, what was checked, what was found, overall risk level (SAFE / REVIEW / CRITICAL / BLOCKED).
