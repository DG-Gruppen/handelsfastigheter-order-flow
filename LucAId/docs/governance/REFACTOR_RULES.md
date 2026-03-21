## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.7.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for refactor guidance and split targets
- Depends On: `governance/CHANGE_SAFETY_RULES.md`, `governance/KNOWN_RISKS.md`, `core/ARCHITECTURE.md`, `core/DOMAIN_RULES.md` §16
- Used By: `core/AI_ANALYSIS.md` Priority 6
- Owner: DG Gruppen
- Update Triggers: new refactor candidates identified, new architecture patterns introduced

---

## Purpose

Defines when Claude Code should recommend refactoring, splitting files, or extracting logic across SHF Intra.

---

## Main goal

Refactoring should improve one or more of: permission correctness, workflow clarity, duplicate policy logic, testability of state transitions, separation of concerns between UI / business logic / data fetching / side effects.

Refactoring should **not** be suggested only for style or file length.

---

## When to split a file

Split when:
- One file has multiple unrelated responsibilities
- Permission logic is embedded inside page rendering
- Duplicated logic exists elsewhere and creates divergence risk
- UI, business logic, data fetching, and side effects are mixed unsafely

Do not split when:
- The file is cohesive despite being large
- Splitting increases indirection without benefit

---

## Preferred split targets

- UI / presentation layer
- Business / domain logic
- Data-fetching hook
- Permission helper
- Side-effect handler (notifications, email, logging)

---

## High-priority refactor signals in SHF Intra

| Signal | Example |
|---|---|
| Page combines rendering + DB writes + side effects | `NewOrder.tsx`, `OrderDetail.tsx` |
| Admin page mixes visibility logic and rendering | `Admin.tsx` |
| Permission logic duplicated across hooks without shared invariant | `useAdminAccess` + `useModulePermission` slug mappings |
| Sensitive subsystem logic embedded in page components | Password decryption in `Passwords.tsx` |
| Email dispatch called directly from page without error handling | `send-email` calls in order pages |

---

## Refactor candidates

| File | Signal |
|---|---|
| `src/pages/NewOrder.tsx` | Approval routing + persistence + notifications + email in one page |
| `src/pages/OrderDetail.tsx` | Lifecycle transitions + authorization + optimistic UI + side effects |
| `src/pages/Admin.tsx` | Visibility logic + rendering mixed; section slug mapping embedded |
| `src/pages/Passwords.tsx` | Crypto logic + access control + audit logging mixed with UI |
| `src/hooks/useAdminAccess.tsx` | Slug mapping could drift from `useModules` — candidate for shared constant |

---

## What Claude must not assume

- That every large file must be split
- That more files always means better architecture
- That a refactor is safe unless auth, permissions, and lifecycle implications are considered

---

## Output format for refactor suggestions

- **Why the current file is risky** — specific evidence of mixed concerns or divergence risk
- **What should be extracted** — named helper, hook, or module with clear responsibility
- **Suggested file boundaries** — what goes where
- **What remains in the original file**
- **Invariants to preserve** — which `core/DOMAIN_RULES.md` §16 invariants this refactor must not disturb

Propose as a series of small, verifiable steps — never as a single broad rewrite.
