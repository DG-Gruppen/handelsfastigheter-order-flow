## Väg B — Skrota roll-lagret, gör grupper till sanningskällan

Du har rätt: långsiktigt är detta renare. Och med rätt sekvens är det säkert. Nyckeln är att **ändra ingenting destruktivt förrän nya systemet bevisat sig parallellt**.

---

## Designprincip

Efter refaktorn finns bara två koncept:
1. **Grupper** — namngivna behållare för användare (Anställda, Chefer, IT, Underchefer, Region Nord, …)
2. **Modulbehörigheter per grupp** — `can_view/can_edit/can_delete/is_owner` per (grupp, modul)

Dessutom några **systemflaggor på grupper** som ersätter dagens roll-kollar utanför moduler:
- `is_admin_group` (boolean) — ger åtkomst till admin-panel, kan hantera grupper/användare
- `is_it_group` (boolean) — får göra impersonation, hantera integrationer
- `is_manager_group` (boolean) — får godkänna ordrar från sina underordnade

Det är **3 binära flaggor** istället för 5 roller — mappar exakt till de få platser där "rollen" faktiskt betyder något utöver modulåtkomst.

`app_role` enum, `user_roles`-tabell och `has_role()` försvinner till slut.

---

## Sekvensen — 6 faser, varje fas är säker att stanna vid

### Fas 0 — Förberedelse (ingen kod-ändring, ingen risk)
- Inventera **alla** anrop till `has_role()`, `app_role` och rollnamnssträngar i:
  - 40+ RLS-policys (script: `pg_policies` där `qual` matchar `has_role`)
  - 6 Edge Functions
  - Frontend (`useAuth`, `useAdminAccess`, `OrderDetail`, `ProfilePanel`, dokument-UI, …)
  - `document_folders.access_roles` / `write_roles`-arrayer
- Producera en **checklista** (`docs/refactor/role-removal.md`) med varje träff och dess ersättning.

→ **Stoppunkt:** Vi vet exakt vad som måste ändras innan en rad kod skrivs.

### Fas 1 — Lägg till nya kolumner & funktioner *parallellt*
**Migration (additiv, bryter inget):**
```sql
ALTER TABLE public.groups
  ADD COLUMN is_admin_group   boolean NOT NULL DEFAULT false,
  ADD COLUMN is_it_group      boolean NOT NULL DEFAULT false,
  ADD COLUMN is_manager_group boolean NOT NULL DEFAULT false;

-- Sätt flaggor utifrån dagens role_equivalent
UPDATE public.groups SET is_admin_group   = true WHERE role_equivalent = 'admin';
UPDATE public.groups SET is_it_group      = true WHERE role_equivalent = 'it';
UPDATE public.groups SET is_manager_group = true WHERE role_equivalent = 'manager';
-- Underchefer manuellt:
UPDATE public.groups SET is_manager_group = true WHERE name = 'Underchefer';

-- Nya security definer-funktioner som använder grupper
CREATE FUNCTION public.is_in_admin_group(_uid uuid) RETURNS boolean ...
CREATE FUNCTION public.is_in_it_group(_uid uuid) RETURNS boolean ...
CREATE FUNCTION public.is_in_manager_group(_uid uuid) RETURNS boolean ...
CREATE FUNCTION public.user_in_group(_uid uuid, _group_slug text) RETURNS boolean ...
```

→ Inget anropar dem ännu. Befintliga policys och `has_role()` fortsätter fungera oförändrat.

### Fas 2 — Migrera RLS-policys policy-för-policy
För varje RLS-policy som idag använder `has_role(uid, 'admin')`:
- Skriv om till `is_in_admin_group(uid)` (eller motsvarande).
- Verifiera mot testanvändare i varje grupp.
- Mätare: kör `pg_stat_user_functions` före/efter för att fånga ev. perf-regress.

Görs i **5–6 mindre migrationer**, grupperade per modulområde:
1. Orders + order-relaterade tabeller
2. Categories/departments/order_types
3. KB / News / IT FAQ / Prompts
4. Chat-tabeller
5. Modules / module_permissions / groups
6. Övrigt (notifications, integrations, email_log, …)

Efter varje migration: smoke-test i preview, sen produktion. Rollback = en migration tillbaka.

### Fas 3 — Migrera Edge Functions
6 funktioner, alla isolerade:
- `impersonate-user` → kolla `is_in_it_group` eller `is_in_admin_group`
- `database-backup` → `is_in_admin_group`
- `import-google-workspace` → `is_in_admin_group`
- `update-integration-secret` → `is_in_admin_group`
- `accept-external-invite`, `auth-email-hook` → kontrollera, oftast bara service role

Deploy en åt gången, testa via admin-UI.

### Fas 4 — Migrera frontend
- `useAuth` exponerar `groups: Group[]` + härledda booleans `isAdmin`, `isIT`, `isManager` (baserade på gruppflaggor, inte roller).
- Sök-och-ersätt: `roles.includes('admin')` → `isAdmin` etc.
- `useAdminAccess` — använd nya booleans.
- `OrderDetail` — godkännandelogik baseras på `is_manager_group` + hierarki.
- `MyEffectivePermissions` — visa **grupper + per-modul-rättigheter** istället för "roller".
- Admin → Grupper-UI: lägg till tre toggles (Admin-grupp / IT-grupp / Chefs-grupp) med tooltips som förklarar konsekvenser.

### Fas 5 — Migrera `document_folders.access_roles`
Idag är detta en `text[]` med rollnamn. Byt till `group_ids uuid[]`:
```sql
ALTER TABLE document_folders 
  ADD COLUMN access_group_ids uuid[],
  ADD COLUMN write_group_ids  uuid[];
-- migrera värden: 'admin' → admin-gruppens id, etc.
-- skriv om has_folder_access() att använda nya kolumnerna
-- behåll gamla i 1 release för säkerhet
```

### Fas 6 — Städa bort det gamla
När fas 1–5 körts i produktion **i minst 2 veckor utan incidenter**:
- DROP-a `has_role()`, `user_roles`-tabellen, `app_role`-enum, `groups.role_equivalent`, gamla `access_roles`/`write_roles`.
- Ta bort `roles`-fältet från `useAuth`.
- Uppdatera memory: "Behörigheter = rena gruppbehörigheter, inga roller".

---

## Riskhantering

| Risk | Mitigering |
|---|---|
| Glömd RLS-policy → någon låses ute | Fas 0:s inventering + script som listar **alla** kvarvarande `has_role`-träffar efter varje fas. CI-check som failar om en träff finns kvar efter Fas 6. |
| Användare loggad in under migration | Realtime invalidate på `groups` (finns redan). Backend-funktioner kollar nya systemet direkt. |
| Edge Function-deploy går sönder | Varje Edge Function deployas separat med smoke-test. Rollback = återställ en fil. |
| Hierarkisk manager-logik (subordinate orders) går sönder | `is_subordinate_order()` kollar redan `manager_id`-kedjan, inte rollnamnet — bara `has_role(_, 'manager')` byts mot `is_in_manager_group()`. |
| Document folders låser ut användare | Fas 5 körs **efter** att alla har testats med dubbla kolumner i en release. |
| Superadmin-gruppen tappar åtkomst | `is_admin_group=true` på Superadmin sätts i Fas 1. |

---

## Tidsuppskattning
- Fas 0: 1 h (inventering)
- Fas 1: 30 min (additiv migration)
- Fas 2: 3–4 h fördelat på 5–6 migrationer
- Fas 3: 1 h
- Fas 4: 2–3 h
- Fas 5: 1 h
- Fas 6: 30 min (efter karenstid)

**Totalt aktivt arbete: ~10 h**, utspritt över ca 2 veckor med karenstider mellan faserna.

---

## Det administratören ser efter refaktorn

I **Admin → Grupper**:
- Lista över grupper. Varje grupp har:
  - Namn, färg, beskrivning
  - Tre toggles: ☐ Adminbehörighet  ☐ IT-behörighet  ☐ Chefsbehörighet
  - Lista över medlemmar
  - Lista över moduler den har behörighet till (med view/edit/delete/owner per modul)

I **Admin → Moduler → Behörigheter**:
- En matris: rader = grupper, kolumner = view/edit/delete/owner. **En enda sanningskälla.**

I **Profil → Mina behörigheter**:
- "Du tillhör grupperna: …"
- "Det ger dig: admin ja/nej, IT ja/nej, chef ja/nej"
- "Du kan se följande moduler: …"

**Inga roller. Inga lager. En modell.**

---

## Beslut innan vi börjar

1. **Behåller vi `employee` som default-nivå för alla inloggade?** Förslag: ja, men implicit — varje autentiserad användare som *inte* är extern får basåtkomst utan att tillhöra någon grupp. (Idag är "Anställda"-gruppen i praktiken obligatorisk.)
2. **Vill du att jag börjar köra Fas 0 + Fas 1 nu**, eller väntar vi och du läser planen först?

Säg till så drar jag igång — eller justerar planen om något känns fel.
