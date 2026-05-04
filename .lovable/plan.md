## Diagnos: tre rotorsaker till behörighetsproblemen

Efter att ha gått igenom `module_permissions`, RLS-policys (`has_module_permission`, `has_module_slug_permission`), `useModulePermission`-hooken, `resolveModuleAccess` och faktisk data i databasen, finns det **tre tydliga buggar** som tillsammans förklarar varför rättigheter inte beter sig som du förväntar dig — och varför symtomen varierar mellan moduler.

---

### Problem 1 — `is_owner` betyder olika saker i frontend och backend

**Frontend** (`resolveModuleAccess`): `isOwner = true` räknas som "full behörighet" → `canEdit/canDelete` blir true automatiskt.

**Backend** (`has_module_permission` / `has_module_slug_permission`): kollar EXAKT vilken flagga som efterfrågas. Om en RLS-policy frågar `'edit'` och raden bara har `is_owner=true` (men `can_edit=false`) → **nekas**.

Konsekvens: En grupp som markeras som "ägare" i UI:t kan se modulen men *inte spara/radera*, trots att UI:t visar knappar.

I databasen finns idag 30+ rader där `is_owner=true` också har `can_view/can_edit/can_delete=true`, vilket maskerar buggen — men så fort någon admin kryssar i bara "ägare" utan resten, går det sönder.

### Problem 2 — `can_delete` utan `can_edit` (och `can_edit` utan `can_view`)

Frontend tillåter att admins kryssar i delete utan edit, eller edit utan view. Men:
- RLS för UPDATE kollar bara `can_edit` → går igenom, men användaren ser inte raden (saknar SELECT) → "ingenting händer".
- För moduler som använder slug-baserad RLS (nyheter, prompts, kpi, kb, planner, it-support, history, losenord) är detta särskilt synligt.

### Problem 3 — Slug-baserade RLS tar INTE hänsyn till `module_role_access` eller admin-roll-via-grupp på rätt sätt

`has_module_slug_permission` kollar **enbart** `module_permissions` (explicita user/group-grants). Den kollar inte:
- `module_role_access` (rollbaserad standardåtkomst)
- Användarens *roller* alls

Frontend (`resolveModuleAccess`) däremot faller tillbaka på `module_role_access` när explicita grants saknas. Det betyder att en användare kan **se** modulen via roll men inte **skapa/redigera** något, eftersom INSERT/UPDATE-policys bara accepterar explicita module_permissions.

Detta är exakt mönstret vi nyss åtgärdade för "Anställda"-gruppen och prompts — och samma sak gäller alla slug-baserade moduler. Konkret betyder det att grupper som **Anställda, Underchefer, Chefer, Stab** står som `view-only` på `documents, history, it-support, kunskapsbanken, losenord, tools` — så ingen utöver IT/Admin kan faktiskt redigera där, även om UI antyder att rollen ger åtkomst.

---

## Lösningsplan (fyra steg)

### Steg 1 — Normalisera semantiken för `is_owner` i backend

Uppdatera `has_module_permission` och `has_module_slug_permission` så att `is_owner=true` **implicit** ger view, edit och delete:

```text
WHEN 'view'   THEN (mp.can_view   OR mp.is_owner)
WHEN 'edit'   THEN (mp.can_edit   OR mp.is_owner)
WHEN 'delete' THEN (mp.can_delete OR mp.is_owner)
WHEN 'owner'  THEN mp.is_owner
```

Detta matchar frontend och eliminerar Problem 1 utan att behöva städa befintlig data.

### Steg 2 — Inför dataintegritetsregler (CHECK-trigger)

Lägg till en BEFORE INSERT/UPDATE-trigger på `module_permissions` som auto-justerar:
- `can_delete=true` ⇒ tvinga `can_edit=true`
- `can_edit=true` ⇒ tvinga `can_view=true`
- `is_owner=true` ⇒ tvinga alla tre true

Plus en engångs-städning på befintlig data så att alla rader blir konsekventa.

### Steg 3 — Rensa "tomma" permission-rader

7 rader i `module_permissions` har alla flaggor = false. De gör inget men förvirrar UI och felsökning. Ta bort dem.

### Steg 4 — Rätta UI:n i `ModulePermissionsManager`

I admin-panelens behörighetsmatris:
- När admin kryssar i "Delete" → kryssa automatiskt i "Edit" + "View"
- När admin kryssar i "Edit" → kryssa automatiskt i "View"
- "Owner"-kryssrutan → låt övriga vara grå/disabled och visuellt markerade som "ingår"
- Tooltip som förklarar hierarkin

Detta gör att admins inte längre kan skapa inkonsekventa permission-rader via UI:t.

### Steg 5 (valfritt men rekommenderat) — Fyll på saknade gruppbehörigheter

Som tidigare gjordes för "Anställda" + prompts, behöver vi fatta beslut om vilka grupper som faktiskt ska kunna **redigera** i:
- `kunskapsbanken` (idag bara IT + Kunskapsbanken-gruppen kan redigera)
- `it-support` FAQ
- `history`-modulen
- `losenord` (vem ska få lägga till lösenord?)
- `tools`
- `documents`

Detta beslut tar vi efter att 1–4 är på plats, modul för modul.

---

## Tekniska detaljer

**Migration som skrivs i steg 1+2+3:**
- `CREATE OR REPLACE FUNCTION` för `has_module_permission` och `has_module_slug_permission` med ny CASE-logik
- `CREATE TRIGGER normalize_module_permissions BEFORE INSERT OR UPDATE ON module_permissions`
- `UPDATE module_permissions SET can_view=true WHERE can_edit OR can_delete OR is_owner; UPDATE … can_edit=true WHERE can_delete OR is_owner; …`
- `DELETE FROM module_permissions WHERE NOT can_view AND NOT can_edit AND NOT can_delete AND NOT is_owner;`

**Frontend-filer som påverkas i steg 4:**
- `src/components/admin/ModulePermissionsManager.tsx` — checkbox-hierarki + visuell markering

**Inga RLS-policys behöver ändras** — de fortsätter anropa samma funktioner, men funktionerna ger nu rätt svar.

---

## Vad förväntas hända efter åtgärden

| Symtom idag | Efter fix |
|---|---|
| Sätter "Owner" på grupp → kan inte redigera | Owner ger automatiskt edit+delete+view |
| Sätter "Edit" → ser inte raderna | Edit kräver/får automatiskt view |
| Olika beteende mellan moduler | Konsekvent över alla slug-baserade moduler |
| 30+ rader är "rätt" pga manuell dubbelkryssning | Trigger garanterar konsekvens framöver |

Säg till om jag ska köra igång steg 1–4, eller om du vill att vi börjar med bara migrationen (1–3) och tar UI-städningen separat.