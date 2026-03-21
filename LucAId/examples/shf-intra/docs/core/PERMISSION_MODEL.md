## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.4.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for permission sources, precedence, and conflict rules
- Depends On: `core/DOMAIN_RULES.md` §2, §6, §18
- Used By: `core/AI_ANALYSIS.md`, `core/ARCHITECTURE.md`, `core/WORKFLOW_MAPS.md`, `governance/KNOWN_RISKS.md`
- Owner: DG Gruppen
- Update Triggers: auth hooks changed, new permission source added, new role added, admin access logic changed

---

## Purpose

Normalize access-control reasoning across all modules of SHF Intra. Every permission finding must reference this file for precedence and conflict rules.

Role definitions are owned by `core/DOMAIN_RULES.md` §2. This file owns how permissions are resolved and how conflicts are handled.

---

## Core principle

Frontend visibility is not authorization. A visible button, a rendered route, or a hook returning `true` is not proof that a backend action is permitted.

---

## Permission sources

| Source | Type | Precedence layer |
|---|---|---|
| `user_roles` | Direct role assignment | Roles — highest for role-based decisions |
| `group_members` + `groups.role_equivalent` | Group-derived role | Roles — lower than direct |
| `module_permissions` (user entry) | Explicit user-level module permission | Module access — highest |
| `module_permissions` (group entry) | Explicit group-level module permission | Module access — second |
| `module_role_access` | Role-based module access rule | Module access — third |
| Default (no rules) | Accessible to all authenticated users | Module access — lowest |
| `useAdminAccess` | Hook-computed admin section access | Frontend-only; not final authorization |
| `useModulePermission` | Hook-computed module permission | Frontend-only; not final authorization |
| Inline role checks | `roles.includes("admin")` etc. | Frontend-only; not final authorization |

---

## Intended precedence — module access

Evaluate in this order. A higher layer cannot be revoked by a lower one.

1. **Explicit deny** — backend deny overrides everything
2. **Admin override** — admin role grants full access regardless of module rules
3. **Explicit user permission** — direct `module_permissions` entry for the user
4. **Explicit group permission** — `module_permissions` entry for the user's group
5. **Role-based module access** — via `module_role_access`
6. **Default open** — no rules present; module is accessible to all authenticated users
7. **UI convenience flags** — nav settings, frontend route guards (not authorization)

---

## Intended precedence — roles

Direct roles take precedence over group-derived roles. (`core/DOMAIN_RULES.md` §2)

**Current risk:** `useAuth.tsx` merges roles via `new Set()` — a union without priority ordering. If consuming code does not apply direct-role precedence explicitly, a group-derived role could shadow a direct role. See `governance/KNOWN_RISKS.md` — Role merge precedence unverified.

---

## Separation of concerns

- Module access ≠ mutation authority. A user may have `can_view` but not `can_edit`.
- Route access ≠ DB mutation authority. Reaching a page does not prove permission to write.
- Admin section visibility ≠ admin mutation authority. UI gating is not RLS.
- Role ≠ module permission. A manager may have module access revoked for a specific section.
- Navigation visibility ≠ route reachability. Disabled nav items are still reachable via direct URL.

---

## Module permission fields

`module_permissions` rows contain:

| Field | Meaning |
|---|---|
| `can_view` | User can see/access the module |
| `can_edit` | User can create/update content in the module |
| `can_delete` | User can delete content in the module |
| `is_owner` | User has full ownership rights over the module |

When analyzing a permission finding, always identify which of these fields is relevant — do not conflate view access with edit authority.

---

## Admin panel access model

The admin panel has a special access model layered on top of the module system:

- `useAdminAccess` maps admin section IDs to module slugs
- A user can access an admin section if they have `admin`/`it` role OR have `can_edit` on the mapped module slug
- **Risk:** If slug mappings in `useAdminAccess` drift from actual module slugs in the database, sections may be incorrectly exposed or hidden

---

## Document folder access model

Documents use a separate access model from the module system:

- Each folder has `access_roles` (array of role strings) and `write_roles` (array of role strings)
- Access is evaluated by `has_folder_access` and `has_folder_write_access` DB functions
- Access is not inherited from parent to child folder automatically
- Module-level `can_view` on `documents` module is a prerequisite, but folder-level access_roles are the actual control

---

## Password vault access model

- Module-level access (`losenord` module permission) controls who sees the module
- Within the module, password visibility is controlled by `shared_password_groups` RLS — a user sees only passwords where their group appears in `shared_password_groups`
- `can_edit` on the module controls who can create/update passwords
- The AES encryption key is returned to any authenticated user by `get-passwords-key` — the actual data-level protection is entirely RLS on `shared_passwords` and `shared_password_groups`

---

## Impersonation access model

- Only `it` and `admin` roles may impersonate
- Enforcement must be server-side in the `impersonate-user` edge function
- An impersonated session has the full permissions of the target user — it is not a read-only view
- Frontend check in admin panel is a UI convenience only

---

## Role merge behavior

Direct and group-derived roles are merged via `new Set()` in `useAuth.tsx`. This is a union with no built-in priority. Consuming code must apply direct-role priority explicitly.

**Correct pattern:** After merge, check if user has a direct role entry before trusting a group-derived role for sensitive decisions.

**Risk pattern:** `roles.includes("admin")` on the merged set without knowing whether `admin` came from a direct assignment or a group — a group assignment could be maliciously injected if group management is not properly secured.

---

## Conflict rules

If multiple permission sources disagree:

1. Identify all relevant sources.
2. Determine whether precedence is explicit in code or only implicit.
3. Flag ambiguity if the winner is not defined by the precedence list above.

For every conflict, state:
- Which sources are in conflict
- Which layer each source belongs to
- Whether resolution is explicit in code or inferred
- Whether backend enforcement matches intended resolution

---

## Conflict examples

| Scenario | Correct interpretation |
|---|---|
| Route renders but server mutation unverified | Conditional security risk |
| Admin nav visible, admin mutation lacks RLS | High risk if mutation is sensitive |
| `new Set()` role merge without priority logic | Potential role precedence bug |
| Module enabled but role check in page denies action | Access model inconsistency — document which source wins |
| `can_edit` on module but folder `write_roles` excludes role | Folder rule wins for document operations |
| Hook returns `true` for admin, no RLS confirmed | Frontend evidence only — label INFERRED |

---

## Output rules for permission findings

For every permission finding, include:
- **Source of permission** — which hook, table, or inline check
- **Precedence issue** — if a lower layer could override a higher one
- **Scope** — view access, route access, or mutation authority
- **Backend enforcement status** — VERIFIED / INFERRED / UNKNOWN
- **Risk level** — per severity guide in `core/AI_ANALYSIS.md`
