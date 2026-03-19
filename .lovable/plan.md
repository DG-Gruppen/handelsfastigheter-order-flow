

## Förbättringar: Säkerhet, Typsäkerhet, Robusthet & Kodkvalitet

### Sammanfattning
Sex åtgärder: ta bort console.log-läckor, ersätt any-casts, lägg till try-catch, ersätt hårdkodad e-postfiltrering med databaskolumn, skapa constants.ts, och uppdatera imports.

---

### 1. Säkerhet – Ta bort console.log i useAuth.tsx
**Problem:** 4 st `console.log` läcker user_id, e-post och rolldata till webbläsarkonsolen.

**Åtgärd:** Ta bort rad 47, 57–59, 77 och 96 i `src/hooks/useAuth.tsx`.

---

### 2. Typsäkerhet – Ersätt any-casts

**useAuth.tsx:**
- Ersätt `(r: any) => r.role` med `{ role: string }` interface
- Ersätt `(g: any) => (g.groups as any)?.role_equivalent` med typat interface `{ groups: { role_equivalent: string | null } }`

**useModules.tsx (rad 89):**
- Ersätt `(g: any) => g.group_id` med `(g: { group_id: string })`

**UsersContent.tsx (rad 68, 133–136):**
- Ersätt `(m: any)` med `{ user_id: string; group_id: string }`
- Ersätt `(r: any)` i importresultat med `{ status: string }`

---

### 3. Robusthet – try-catch runt JSON.parse i AppSidebar.tsx
**Problem:** Om localStorage-data är korrupt kraschar hela sidebar-komponenten.

**Åtgärd (rad 52–53 och 58–59):** Wrappa `JSON.parse` i try-catch med fallback till defaultvärde.

---

### 4. Databasdriven dold-flagga istället för hårdkodad e-post
**Problem:** `toni@kazarian.se` filtreras bort med hårdkodad string i 4 filer. Odokumenterat och fragilt.

**Bättre lösning:** Lägg till `is_hidden boolean DEFAULT false` på `profiles`-tabellen. Sätt `is_hidden = true` på kontot. Filtrera på `is_hidden` i koden istället för e-postadress.

**Databasändring (migration):**
```sql
ALTER TABLE public.profiles ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET is_hidden = true WHERE email = 'toni@kazarian.se';
```

**Kodändringar i 4 filer:**
- `UsersContent.tsx`: `.filter(p => !p.is_hidden)` istället för e-postcheck
- `GroupsManager.tsx`: `.filter(p => !p.is_hidden)` 
- `ITContent.tsx`: `.filter(p => !p.is_hidden)`
- `ModulePermissionsManager.tsx`: `.filter(p => !p.is_hidden)`

Gruppen "Superadmin" filtreras redan via `g.name !== "Superadmin"` — detta kan förbättras genom att använda det befintliga `is_system`-fältet på `groups`-tabellen: `.filter(g => !g.is_system)` istället. Kräver att Superadmin-gruppen har `is_system = true` (verifieras/sätts i migrationen).

---

### 5. Ny fil src/lib/constants.ts
Centralisera magic strings som används på flera ställen:

```ts
export const ROLES = { ADMIN: "admin", MANAGER: "manager", EMPLOYEE: "employee", STAFF: "staff", IT: "it" } as const;
export const STORAGE_KEYS = { SIDEBAR_COLLAPSED: "shf-sidebar-collapsed", SIDEBAR_ORDER: "shf-sidebar-order" } as const;
```

Uppdatera `AppSidebar.tsx` att använda `STORAGE_KEYS`.

---

### 6. Sammanfattning av filändringar

| Fil | Åtgärd |
|---|---|
| `src/hooks/useAuth.tsx` | Ta bort console.log, typa any-casts |
| `src/hooks/useModules.tsx` | Typa any-cast (rad 89) |
| `src/components/admin/UsersContent.tsx` | Typa any-casts, is_hidden-filter |
| `src/components/admin/GroupsManager.tsx` | is_hidden + is_system-filter |
| `src/components/admin/ITContent.tsx` | is_hidden-filter |
| `src/components/admin/ModulePermissionsManager.tsx` | is_hidden + is_system-filter |
| `src/components/AppSidebar.tsx` | try-catch, STORAGE_KEYS |
| `src/lib/constants.ts` | Ny fil |
| **Migration** | `is_hidden`-kolumn + uppdatera Superadmin `is_system` |

