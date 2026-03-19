

## Optimering av Admin-sidan

### Sammanfattning
Tre fokusområden: (1) lazy-loada alla admin-sektioner for bättre prestanda, (2) flytta felplacerade komponenter till rätt mapp, (3) ersätta hårdkodade färger i Dashboard med semantiska tokens.

---

### 1. Lazy-loada alla admin-sektioner
**Problem:** Idag laddas 12 av 13 sektioner direkt vid sidladdning trots att bara en visas åt gången. Bara `WorkwearAdminPanel` är lazy-loadad.

**Åtgärd i `src/pages/Admin.tsx`:**
- Ersätt alla direktimporter av sektionskomponenter med `lazy()`:
  - `CategoriesManager`, `OrderTypesManager`, `SystemsManager`
  - `KbAdminPanel`, `NewsAdminPanel`, `ToolsManager`
  - `UsersContent`, `GroupsManager`, `ModulePermissionsManager`
  - `SettingsContent`, `ITContent`, `DatabaseBackup`
- Wrappa `renderSection()` med en gemensam `<Suspense>` med spinner-fallback
- Behåll `AdminDashboard` som eager import (visas som startsida)
- Behåll `adminGroups`-konfigurationen och ikoner som eager (liten storlek)

### 2. Flytta komponenter till rätt mapp
**Problem:** `CategoriesManager`, `OrderTypesManager`, `SystemsManager` ligger i `src/components/` istället för `src/components/admin/`.

**Åtgärd:**
- Flytta dessa tre filer till `src/components/admin/`
- Uppdatera importvägar i `Admin.tsx` (de nya lazy-importerna)

### 3. Semantiska färger i AdminDashboard
**Problem:** `AdminDashboard.tsx` använder hårdkodade färger som `text-sky-500`, `bg-amber-500/10`, `text-violet-500` istället för projektets design-tokens.

**Åtgärd i `src/components/admin/AdminDashboard.tsx`:**
- Ersätt med semantiska tokens: `text-primary`, `text-warning`, `text-accent`, `text-destructive` etc.
- Matcha färgschemat som redan används i admin-sidebaren

---

### Tekniska detaljer

**Filer som ändras:**
- `src/pages/Admin.tsx` — alla sektionsimporter blir `lazy()`
- `src/components/admin/AdminDashboard.tsx` — färgbyte
- `src/components/admin/CategoriesManager.tsx` — flyttad fil
- `src/components/admin/OrderTypesManager.tsx` — flyttad fil  
- `src/components/admin/SystemsManager.tsx` — flyttad fil

**Ej i scope (låg risk/nytta):**
- Att bryta ner `KbAdminPanel` (504 rader) och `OrderTypesManager` (500 rader) i delkomponenter — dessa fungerar bra som de är och lazy-loading löser prestandaproblemet

