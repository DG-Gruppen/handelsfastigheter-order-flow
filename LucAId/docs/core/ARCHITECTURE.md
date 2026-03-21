## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.7.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for system layers, data flows, trust boundaries, and enforcement ownership
- Depends On: `docs/SYSTEM_OVERVIEW.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `docs/governance/KNOWN_RISKS.md`
- Owner: DG Gruppen
- Update Triggers: layer changes, trust boundary changes, new backend service, new integration

---

## Purpose

This file describes the system's architecture from the perspective of correctness and security analysis. It defines trust boundaries, enforcement ownership, and blast radius — not deployment topology.

**See also:**
- `docs/SYSTEM_OVERVIEW.md` — module inventory and integration points
- `docs/core/PERMISSION_MODEL.md` — permission enforcement within the architecture
- `docs/reference/DATA_MODEL.md` — data layer detail

---

## System layers

| Layer | Technology | Responsibility | Trust level |
|-------|-----------|----------------|-------------|
| Client | React SPA (Vite + TypeScript + Tailwind) | UI rendering, routing, local state, form validation | **Untrusted** |
| Edge Functions | Deno (Supabase Edge Functions) | Business logic, email dispatch, AI chat, key issuance, impersonation | **Trusted** |
| Database | PostgreSQL (Supabase) | Data persistence, RLS policies, triggers, RPC functions, pgmq queues | **Trusted** |
| Storage | Supabase Storage | File persistence with bucket-level policies | **Trusted** |

---

## Trust boundaries

### Client → Edge Functions
- JWT token passed via `Authorization` header
- Edge Functions verify JWT via Supabase gateway (`verify_jwt = true` in config.toml) except for cron-triggered functions
- Client can call any Edge Function endpoint — authorization depends on function-level checks
- **Gap:** Some functions (e.g. `get-passwords-key`) only verify JWT, not role or group membership

### Client → Database (via Supabase JS client)
- All queries go through PostgREST with RLS enabled
- RLS policies use `auth.uid()` and `has_role()` / `has_module_permission()` functions
- Client can only see/modify rows allowed by RLS
- **Gap:** Some tables have permissive RLS that allows any authenticated user to SELECT/INSERT

### Edge Functions → Database
- Use service role key — bypasses RLS
- Functions must implement their own authorization checks
- **Gap:** Not all functions verify role before performing operations

### Cron → Edge Functions
- pg_cron triggers functions via HTTP with no JWT
- Functions triggered by cron must have `verify_jwt = false` in config.toml
- These functions should not accept user-facing parameters

---

## Enforcement ownership

| Concern | Enforced by | Location | Notes |
|---------|-------------|----------|-------|
| Authentication | Supabase Auth + `ProtectedRoute` | Gateway + Client | Gateway verifies JWT; client redirects to `/login` |
| Role resolution | `has_role()` RPC | Database | Checks `user_roles` + `group_members` → `groups.role_equivalent` |
| Module access | `has_module_permission()` RPC + `useModulePermission` | Database + Client | RPC is server-side; hook is UI convenience |
| Order approval authority | Client-side check in `OrderDetail.tsx` | **Client only** | No server-side check that approver matches `orders.approver_id` |
| Order status transitions | Client-side UPDATE | **Client only** | No server-side state machine; any valid status value accepted |
| Folder access | `has_folder_access()` / `has_folder_write_access()` RPC | Database | SECURITY DEFINER functions check `access_roles` / `write_roles` |
| Password access | `has_shared_password_access()` RPC + RLS | Database | RLS uses the function; but encryption key is returned to all authenticated users |
| Impersonation | IT role check in `impersonate-user` Edge Function | Edge Function | Verified server-side |
| Email sending | Rate limiting in `email_send_state` | Database + Edge Function | `process-email-queue` reads config from `email_send_state` |
| Data validation | Minimal — mostly client-side | **Client only** | Few CHECK constraints in DB |

---

## Data flows

### Order creation flow
```
Client (NewOrder.tsx) → Supabase INSERT orders/order_items → 
  RLS check (authenticated) → Success → 
  Client enqueues email (pgmq via RPC) → 
  pg_cron triggers process-email-queue → 
  Edge Function reads queue → send-email (Resend API)
```

### Password access flow
```
Client (Passwords.tsx) → get-passwords-key Edge Function (JWT only) → 
  Returns AES key → Client queries shared_passwords (RLS: has_shared_password_access) → 
  Client decrypts with AES key
```

### Impersonation flow
```
Client (ImpersonateUserCard.tsx) → impersonate-user Edge Function → 
  Verifies IT/admin role (server-side) → 
  Generates session token for target user → 
  Client stores token → ImpersonationBanner shown
```

### Cision news import flow
```
pg_cron (every 12h) → fetch-cision-feed Edge Function (no JWT) → 
  Fetches RSS feed → Deduplicates by source_url → 
  INSERT into news table with source='cision'
```

### Content indexing flow
```
DB trigger (on INSERT/UPDATE) → index function → UPSERT content_index row
pg_cron (nightly) → sync-content-index Edge Function → batch rebuild
```

---

## Blast radius map

| Component | Blast radius | Reason |
|-----------|-------------|--------|
| `useAuth.tsx` | **All protected pages** | Session, profile, and role resolution for entire app |
| `has_role()` RPC | **All RLS policies using role checks** | Called by RLS on most tables |
| `supabase/migrations/` (RLS) | **All data access** | Misconfigured RLS exposes data globally |
| `groups` table | **All role resolution** | `role_equivalent` drives the entire RBAC system |
| `process-email-queue` | **All email delivery** | Failure stops order notifications, auth emails |
| `content_index` + triggers | **AI assistant accuracy** | Stale index = wrong AI answers |
| `ProtectedRoute.tsx` | **All authenticated routes** | Bypass = unauthenticated access to all pages |

---

## Known architectural risks

| Risk | Severity | Full entry |
|------|----------|------------|
| Order status transitions are client-driven | High | See RISK-1 in `governance/KNOWN_RISKS.md` |
| AES key returned to all authenticated users | High | See RISK-2 in `governance/KNOWN_RISKS.md` |
| Storage bucket policies may not match folder `access_roles` | Medium | See RISK-3 in `governance/KNOWN_RISKS.md` |
| Content index dual-indexing divergence risk | Medium | See RISK-4 in `governance/KNOWN_RISKS.md` |
| `profiles.department` is text, not FK | Low | See RISK-5 in `governance/KNOWN_RISKS.md` |
