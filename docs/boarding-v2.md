# On-/Offboarding v2 (`/boardingv2`)

Ny on-/offboarding byggd **vid sidan av** nuvarande (`/boarding`, tabellerna `onboarding_*`).
Inget i v1 rörs. När v2 är genomtestad slår vi om i en enda PR (se *Omkoppling*).

Underlag: `Onboarding_2026.docx` (Petra), fältkontraktet mot Heartpace (nedan) och
`docs/onboarding-plan.md` som beskriver v1-tänket. Den viktigaste skillnaden mot v1:
**flödet vänds** — Heartpace/HR är startpunkten, chefen gör sina val efteråt.

## Flöde

```
Petra lägger upp person i Heartpace          (eller: HR/chef skapar manuellt / simulerar)
        │
        ▼
boarding_cases  status = awaiting_manager    mejl: boarding-manager-action → närmaste chef
        │
        ▼  chefen väljer system + "om aktuellt"
[awaiting_hr om mallen har require_hr_confirm]   mejl: boarding-hr-confirm → HR-gruppen
        │
        ▼  aktivering
boarding_case_tasks snapshottas från mallen  mejl: boarding-owner-tasks → ett per ansvarig
        │
        ▼  ansvariga bockar av
status = completed                           mejl: boarding-completed → chef + HR
```

Avbryt när som helst (chef eller staff): `boarding-cancelled` till alla med öppna uppgifter.

## Isolering mot v1

| Lager | v1 | v2 |
|---|---|---|
| Tabeller | `onboarding_*` | `boarding_templates`, `boarding_template_tasks`, `boarding_cases`, `boarding_case_tasks`, `boarding_email_log` |
| Enums | `onboarding_*` | `boarding_kind`, `boarding_case_status`, `boarding_task_status`, `boarding_assignee_source`, `boarding_trigger_source` |
| Edge functions | `onboarding-*` | `boarding-case-advance`, `boarding-task-checkoff` |
| Mejlmallar | `onboarding-*`, `offboarding-*` | `boarding-*` (samma registry, samma designtokens via `_boarding-shared.tsx`) |
| Route / modul | `/boarding`, modul `onboarding` | `/boardingv2`, modul `boarding-v2` (**admin + IT** under bygget) |
| Frontend | `src/pages/Boarding*.tsx` | `src/pages/boardingv2/` |

**Delas medvetet** (organisationsregister, inte onboarding-kod): `tools`/`tool_owners`,
`responsibility_areas`/`responsibility_owners`, `external_contacts`, `groups`, `profiles`,
mejlinfrastrukturen (`send-app-email`, Resend, suppression) och Heartpace-synkens läsning.

## Datamodell

**`boarding_templates`** – en per typ. `require_hr_confirm` styr om HR-grinden används.

**`boarding_template_tasks`** – mallens rader. Två saker avgör om en rad tas med i ett ärende:

- `is_system_access = true` → raden är en systembehörighet. Den visas som valbart system
  för chefen och tas med **bara om** `assignee_tool_id` finns i ärendets `selected_tool_ids`.
- `condition_key`:
  - `NULL` → alltid
  - manuell nyckel (`company_car`, `id06`, `bank`, …) → chefen kryssar i; tas med om nyckeln finns i `optional_keys`. `condition_label` är texten chefen ser.
  - auto-nyckel → utvärderas från ärendet: `location_stockholm` (orten innehåller "stockholm"), `trigger_manual` (ärendet kom inte från Heartpace).

Ansvarig resolvas vid aktivering via `assignee_source`:

| Källa | Slår upp |
|---|---|
| `tool_owner` | `tool_owners` för `assignee_tool_id` (profiler **och** externa kontakter) |
| `area_owner` | `responsibility_owners` för `assignee_area_id` |
| `group` | **en** uppgift för gruppen `assignee_group_name` (t.ex. `HR`, `IT`); alla medlemmar får mejlet, vem som helst i gruppen bockar av |
| `nearest_manager` | ärendets `nearest_manager_id` |
| `external_contact` | `external_contacts` (`assignee_external_contact_id`) |
| `static_profile` | `assignee_profile_id` (undviks – planens princip är inga hårdkodade namn) |

**`boarding_cases`** – ett ärende per person. Bär fältkontraktet från Heartpace
(`heartpace_employee_id`, namn, `work_email`, `personal_email`, `title`, `department`,
`location`, `cost_centre`, `employment_form`, chef, datum), chefens val
(`selected_tool_ids`, `optional_keys`), HR-grind, och `google_account_status` för
kommande provisionering. `trigger_source`: `heartpace` | `manual` | `simulated`.
Unikt index hindrar två öppna ärenden av samma typ för samma Heartpace-id.

**`boarding_case_tasks`** – snapshot av mallen per ärende. En rad per ansvarig och
uppgift, utom gruppuppgifter som är en rad per grupp (`assignee_group_name`).
`assignee_email` fylls för personer och externa så att utskick fungerar.

**`boarding_email_log`** – varje utskick, inklusive `redirected_from` i testläge.

### RLS

`boarding_is_staff(uid)` = admin **eller** HR **eller** IT. Ett ärende syns för staff,
närmaste chef, den som skapade det, den som har en uppgift i det (direkt eller via grupp),
och (onboarding) personen själv.

**Uppgifter:** staff och närmaste chef ser hela checklistan. Övriga ansvariga ser **bara
sina egna rader** (direkt eller via grupp) — planens §7.3. Personen själv ser inga
uppgifter. `boarding_case_progress(case_id)` ger "x av y klara" till alla som får se
ärendet utan att avslöja raderna. Uppgifter bockas av av ansvarig, gruppmedlem, chef
eller staff. Statusövergångar går via edge function med service role.

**Personuppgifter i ärendets huvud** (privat e-post, kostnadsställe, anställningsform)
visas i UI:t bara för staff, chef och Stab. Det är en UI-regel, inte en RLS-gräns —
raden är läsbar för alla som får se ärendet. Blir det ett krav flyttas fälten till en
egen tabell med stramare RLS.

## Förhandsvisning innan utskick

Chefens *Granska och skicka in* och HR:s *Bekräfta* anropar först `action = preview`,
som kör exakt samma villkors- och ansvarslogik som aktiveringen men skriver ingenting.
Dialogen visar varje mottagare, antal uppgifter, de första rubrikerna, om mottagaren
får mejlet via en grupp, och en varning för uppgifter utan ansvarig. Är
`BOARDING_EMAIL_REDIRECT` satt står det överst i dialogen. Först efter bekräftelse
körs `manager_submit` / `hr_confirm`.

Bakgrund: systemvalet styr bara raderna med `is_system_access`. Resten av Petras
checklista (HR, Fastighetssnabben, nycklar, webb, Google-konto) gäller varje nyanställd
och går ut oavsett — förhandsvisningen gör det synligt innan något skickas.

## Testläge för mejl

Sätt secret **`BOARDING_EMAIL_REDIRECT=<din adress>`** i Lovable Cloud. Då går varje
v2-utskick dit istället, med en gul banner "Testläge – skulle ha gått till X", och
loggen visar `redirected_from`. Bara v2 läser variabeln – v1 påverkas inte.
Ta bort variabeln vid omkoppling.

## Simulera Heartpace utan Heartpace

`/boardingv2/ny` har en switch *Simulera Heartpace-post*. Ärendet skapas med
`trigger_source = simulated` genom exakt samma `create`-väg i `boarding-case-advance`
som Heartpace-intaget (nästa etapp) kommer att anropa. Hela kedjan efter detektionen
testas alltså utan att röra Heartpace.

## Fältkontrakt mot Heartpace (employment-info)

| Behov | Sökväg |
|---|---|
| Stabil nyckel | `user_account.uuid` |
| Aktiv anställning | `is_current`, `user_account.account_status` |
| Datum | `data.start_date`, `data.end_date` |
| Person | `personal_data.first_name/.middle_name/.last_name/.work_email/.personal_email/.mobile_work_phone/.birth_date` |
| Placering | `job_informations[].position.name`, `.department.{uuid,name,color}`, `.manager.*`, `.location.name`, `.cost_centre.{name,number}` |
| Villkor | `statuses[].employment_form.name`, `data.termination_reason.name` |

Öppet: chefsobjektets form (`uuid`/`work_email` eller bara namn). Om bara namn →
namnmatchning mot `profiles.full_name` med `manager_name_raw` som reserv och manuellt val i UI.

## Seed (migrationen `20260909094653_ba118a38-c474-4a74-965e-58b9e55c0739.sql`)

- Grupp **HR** med Petra (fanns inte; `is_in_hr_group` matchar på namnet).
- Verktyg **Rekyl**, **IT-hotellet**, **Bereko** (inaktiva, utan länk – syns inte på `/verktyg`
  men ägarkopplingen fungerar). Ägare Emma / Emma / Jörgen.
- Ansvarsområden: `nycklar-passage`, `uniguide-fastighetslistor` (Christel),
  `webb-intranat-kontakt` (Inga), `bankbehorighet` (Emma).
- Extern kontakt: Agnes Eriksson, Fastighetssnabben.
- Mall **SHF Onboarding** = Petras checklista rad för rad. Mall **SHF Offboarding** = spegel, utkast.

Att bekräfta med Petra: Momentum-ägare (registret: Jörgen, dokumentet: Wilma) och
om "förändringar i fastighetslistor" ska vara en onboarding-uppgift eller en stående rutin.

## Etapper

| | Innehåll | Status |
|---|---|---|
| A | Schema, RLS, modul, seed, `/boardingv2`, chefens val, HR-grind, utskick, avbockning, testläge | **klar (denna PR)** |
| B | Heartpace-intag: cron-körning som upptäcker anställd utan profil → `create` med `trigger_source = heartpace`; "Inspektera fält"-knapp i Integrationer för att verifiera chefsobjektet | |
| C | Google Workspace: konto i rätt OU (auto-licens per OU i Admin-konsolen), grupper, intra-profil skapas/länkas, `google_account_status` | |
| D | Drift: cron för påminnelser (T-7/T-3/T-1), extern avbockning via token (Agnes), in-app-notiser, mall-editor för v2 | |
| E | Omkoppling | |

## Omkoppling (när v2 är godkänd)

1. `/boarding` → v2-sidorna, modulen `onboarding` avaktiveras, `boarding-v2` byter namn/slug och tar dess plats.
2. `BOARDING_EMAIL_REDIRECT` tas bort.
3. v1-funktionerna (`onboarding-*`) tas ur `config.toml`; `onboarding_*`-tabellerna lämnas läsbara en period och droppas sedan (4 ärenden, 1 platshållaruppgift – inget att migrera).
4. `_boarding-shared.tsx` får egna designtokens när `_onboarding-shared.ts` försvinner.

## Deploy

Grupp-uppgifter: `20260909101130_67d10123-….sql` (kolumnen `assignee_group_name`,
`boarding_in_task_group`, uppdaterad `boarding_has_task` och avbocknings-policy).
Uppgiftssynlighet: `20260909120000_boarding_v2_task_visibility.sql` (SELECT-policy
"ansvarig ser sina", `boarding_case_progress`).

Applicerat 2026-09-09 via Lovable-agenten, som skrev migrationen som
`20260909094653_ba118a38-…sql` (registrerad i `supabase_migrations.schema_migrations`)
och deployade `boarding-case-advance` och `boarding-task-checkoff`. Kommande
schemaändringar går samma väg: SQL i repot → merge → be agenten applicera.
Sätt `BOARDING_EMAIL_REDIRECT` innan första testet.
