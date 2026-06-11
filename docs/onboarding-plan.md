# Onboarding / Offboarding — Plan

> Levande dokument. Vi itererar här innan kod skrivs.
> Senast uppdaterad: 2026-06-11

## 1. Vad Petra vill ha (kärnan)

Onboarding ska vara en **chefs-initierad, HR-koordinerad checklista** som följer den nyanställde från beslut att anställa till färdig introduktion. Varje uppgift har en **ansvarig person/funktion** som får ett **eget mejl** med bara sina uppgifter och bockar av dem i intranätet så HR ser status i realtid.

Samma struktur ska kunna återanvändas för **offboarding** senare.

### Det verkliga flödet (uppdaterat efter feedback)

Onboardingen startar **inte** hos HR — den startar hos närmaste chef efter en lyckad rekrytering. HR kommer in i bild när chefen lämnar över kandidatuppgifterna.

```text
┌─ Fas 0: Rekrytering (närmaste chef) ─────────────────────────────┐
│  Intervjuer → beslut → kandidat tackar ja                         │
└──────────────────────────┬────────────────────────────────────────┘
                           ▼
┌─ Fas 1: Chef initierar onboarding i intranätet ──────────────────┐
│  Chef öppnar /onboarding → "Starta ny onboarding"                 │
│  Fyller i: namn, e-post, befattning, startdatum, avdelning,       │
│            ev. tjänstebil/ID06/bank-flaggor                       │
│  → Skapar en onboarding-instans i status 'pending_hr'             │
│  → HR (Petra) får mejl + in-app-notis: "Ny anställd att lägga upp"│
└──────────────────────────┬────────────────────────────────────────┘
                           ▼
┌─ Fas 2: HR registrerar i Heartpace ──────────────────────────────┐
│  Petra granskar uppgifterna, kompletterar (kostnadsställe,        │
│  attestant, lön m.m.) och lägger upp i Heartpace.                 │
│  Markerar "Registrerad i Heartpace" → instansen går till 'active' │
│  → Heartpace-sync länkar instansen mot den nya profilen           │
└──────────────────────────┬────────────────────────────────────────┘
                           ▼
┌─ Fas 3: Mejl ut till alla ansvariga ─────────────────────────────┐
│  Intranätet skickar ett samlat mejl per ansvarig (chef,           │
│  Fastighetssnabben, Christel, systemägare för verktygen, etc.)    │
│  Variabler [namn] [startdatum] [befattning] [chef] fylls i.       │
└──────────────────────────┬────────────────────────────────────────┘
                           ▼
┌─ Fas 4: Avbockning & uppföljning ────────────────────────────────┐
│  Varje ansvarig bockar av i intranätet.                           │
│  HR och chef ser progress live.                                   │
│  När alla punkter är klara → status 'completed'.                  │
└───────────────────────────────────────────────────────────────────┘
```

### Varför chefen initierar

- **Chefen vet först** — beslutet är fattat hos hen, inte hos HR.
- **HR slipper jaga information** — chefens formulär fångar grunddata, Petra kompletterar bara det HR-specifika.
- **Alla tasks aktiveras först när HR bekräftat i Heartpace (Fas 2).** Risken med att aktivera chef-tasks redan i Fas 1 är att förberedelser (lunchbokning, blomma, intro) startas innan kontraktet är påskrivet. I Fas 1 är instansen i status `pending_hr` och syns för chef + HR, men inga mejl skickas och inga tasks är aktiva.
- **Vem får initiera?** Alla chefer (alla med minst en `manager_id`-relation under sig, eller flagga `can_initiate_onboarding` på profil) kan starta en onboarding. Organisationen är liten nog att inte behöva en separat "rekryteringsrätt"-roll i nuläget — kan införas retroaktivt om behovet uppstår.
- **Spårbarhet** — varje onboarding har en tydlig ägare (chefen) och en HR-ansvarig (Petra) från dag 1.



---

## 2. Ansvariga & uppgiftsgrupper

**Princip:** Inga personnamn hårdkodas i mallen. Ägarskap lagras som data och mallen pekar bara på *vilken källa* ansvaret kommer från. Word-dokumentets namnlista är bara dagens utfall — den ska aldrig speglas i kod.

För att täcka alla case i Word-dokumentet behöver vi **tre ägarskaps-register** + två relations-baserade källor:

| Källa | Vad det är | Var ägaren lagras | Word-dokumentets exempel |
|---|---|---|---|
| `tool_owner` | Ägare till ett **system/verktyg** | `tools` + `tool_owners` (finns) | Rillion, Vitec/3L, Rekyl, IT-hotellet, Bank, Creditsafe, Momentum, Webport, Bereko, iBinder, Metry, Vyer, Zendesk, Uniguide, Spiris, Collectum, What's Up Kris |
| `area_owner` | Ägare till ett **ansvarsområde** som inte är ett system | `responsibility_areas` + `responsibility_owners` (nya) | Nycklar & passerkort, SHF:s webbsida, Fastighetslistor |
| `role` | Generisk grupp/roll | `groups` (finns) | HR-arbete (avtal, försäkringar, anställningsförteckning, Heartpace-registrering), IT-arbete |
| `nearest_manager` | Nyanställdas chef | `profiles.manager_id` (finns) | Välkomstmejl, lunch, blomma, introduktion, info till org |
| *(ägaren kan vara extern)* | Person utanför `profiles` | `external_contacts` (ny) | Agnes Eriksson (Fastighetssnabben → Spiris, Collectum) |

### Varför separera `tools` och `responsibility_areas`?

- Ett **verktyg** har URL, FAQ, beskrivning, ikon, är synligt på `/verktyg`, kan favoritmarkeras osv. Det vore fel att lägga in "Nycklar" där bara för att någon äger frågan.
- Ett **ansvarsområde** är bara `{ slug, namn, beskrivning, ägare[] }` — inget mer. Det visas inte på `/verktyg`. Det enda syftet är att vara en pekare som mallen och andra processer kan rikta sig mot.
- Båda registren administreras i `/admin → Ansvar` (delad vy med två flikar: *Verktyg* / *Ansvarsområden*).

### Varför `external_contacts` istället för att tvinga Agnes till `profiles`?

- Agnes är extern konsult — hon ska inte ha intranät-inlogg, inte synas i personalkatalogen, inte räknas som anställd någonstans.
- `external_contacts` är ett minimalt register: `{ name, email, organization, role_description }`. Inga inloggningar, ingen RLS-komplexitet.
- `tool_owners` och `responsibility_owners` får båda kunna peka på **antingen** `profile_id` **eller** `external_contact_id` (XOR-constraint). Mejlutskicket bryr sig bara om e-postadressen.
- Bonus: löser samma problem för framtida externa partners (revisor, försäkringsmäklare m.fl.) utan att vi behöver återbesöka modellen.

**Konsekvens:** Byter SHF systemägare eller områdesansvarig följer alla framtida onboardings/offboardings med automatiskt — oavsett om den nya ägaren är intern eller extern.

---

## 3. Gap mellan dagens system och Petras vision

| Område | Idag | Behövs |
|---|---|---|
| Triggning | Manuellt formulär (orderbaserat) | Auto från Heartpace-sync vid ny anställd |
| Datamodell | `orders` + `order_items` | `onboarding_instances` + `onboarding_tasks` |
| Ansvar | En godkännare per order | Många ansvariga (en per uppgiftsgrupp) |
| Mejl | Ett mejl till godkännare | Ett samlat mejl per ansvarig |
| Avbockning | pending/approved/delivered | Per-uppgift `done` + tidsstämpel + kommentar |
| HR-överblick | Orderlistan | Dashboard "Pågående onboardings" med progress per person |
| Mallhantering | Hårdkodad | Redigerbar mall i admin |

---

## 4. Dynamisk koppling till `/verktyg` (huvudidén för fas 1)

Mall-uppgifter får en fälttyp `assignee_source` som styr **vem** som blir ansvarig vid skapande:

| `assignee_source` | Betydelse | Pekar på |
|---|---|---|
| `tool_owner` | Ägaren/ägarna till ett verktyg | `tool_id` |
| `area_owner` | Ägaren/ägarna till ett ansvarsområde | `responsibility_area_id` |
| `role` | Alla i en grupp/roll | `assignee_role` (t.ex. `hr`, `it`) |
| `nearest_manager` | Nyanställdas chef från Heartpace | — |

> **Inga statiska personnamn i mallen.** Behövs en specifik person så är hen ägare till motsvarande verktyg eller ansvarsområde — det är enda stället ägarskap lagras. Externa personer (Agnes m.fl.) ligger som `external_contacts` och kopplas in på samma sätt.

### Vinster
- Byter SHF systemägare eller områdesansvarig i `/admin → Ansvar` ändras automatiskt vem som får framtida onboarding-mejl.
- Flera ägare per verktyg/område → flera mottagare för samma uppgift utan dubbletter.
- Mallen blir kortare och **personoberoende**: en rad per verktyg/område, systemet grupperar mejlen per ansvarig vid utskick.
- Snapshot vid skapande: när en onboarding-instans skapas resolvas alla `assignee_source` till konkreta mottagare på taskraden, så senare ägarbyten **inte** påverkar pågående onboardings.
- Mejl funkar lika bra för interna profiler som för externa kontakter (samma `recipient_email`-fält i `onboarding_email_log`).

### Mejlmallens placeholders utökas
- `[verktyg]` — verktygets/områdets namn
- `[ansvarig]` — mottagarens förnamn
- Befintliga: `[namn]`, `[startdatum]`, `[befattning]`, `[chef]`

### Datapunkter att lägga upp innan mallen rullas ut

**Som `tools` (finns/kompletteras):** Rillion, Vitec/3L, Rekyl, IT-hotellet, Bank, Creditsafe, Momentum, Webport, Bereko, iBinder, Metry, Vyer, Zendesk, Uniguide, Spiris, Collectum, What's Up Kris.

**Som `responsibility_areas` (nya, icke-system):**
- `keys-access` — Nycklar & passerkort
- `website-contacts` — Kontaktuppgifter på SHF:s webbsida
- `property-lists` — Fastighetslistor

**Som `external_contacts`:**
- Agnes Eriksson (Fastighetssnabben) — kopplas som ägare till `tools` Spiris och Collectum.

### Mall-rader som varken är `tool_owner` eller `area_owner`
- HR-arbete (avtal, försäkringar, anställningsförteckning, Heartpace-registrering) → `role: hr`
- Närmaste chefs-uppgifter (välkomstmejl, lunch, blomma, introduktion, info till org) → `nearest_manager`

---

## 5. Datamodell

```text
-- Nya ägarskaps-register (delas av onboarding/offboarding och framtida processer)

external_contacts                  -- ✅ IMPLEMENTERAD (migration kör)
  id, company_name (nullable), full_name, email (nullable),
  phone (nullable), notes (nullable), is_active,
  created_by, created_at, updated_at

responsibility_areas              -- icke-system, t.ex. nycklar, webbsida
  id, slug, name, description, is_active

responsibility_owners             -- many-to-many; ägaren är intern ELLER extern
  id, area_id,
  profile_id          nullable,
  external_contact_id nullable,
  CHECK (num_nonnulls(profile_id, external_contact_id) = 1)

-- tool_owners är redan utökad: ✅ IMPLEMENTERAD
tool_owners (befintlig, ALTER körd)
  + id (synthetic PK, ersätter gamla composite PK)
  + external_contact_id nullable (FK → external_contacts ON DELETE CASCADE)
  + profile_id nu nullable
  + CHECK (exakt en av profile_id / external_contact_id är satt)
  + unika index per (tool_id, profile_id) resp. (tool_id, external_contact_id)
-- tools.owner_id är nu nullable så ett verktyg kan ägas av endast externa kontakter

-- Onboarding-modellen

onboarding_templates
  id, name, kind ('onboarding' | 'offboarding'), is_active

onboarding_template_tasks
  id, template_id, section, title, description, sort_order,
  assignee_source,                  -- 'tool_owner' | 'area_owner' | 'role' | 'nearest_manager'
  assignee_tool_id          nullable,
  assignee_area_id          nullable,
  assignee_role             nullable,
  is_optional               bool,
  email_template_key        nullable

onboarding_instances
  id, profile_id (nyanställd), template_id,
  start_date, position, manager_id,
  heartpace_employee_id, status, created_at, completed_at

onboarding_tasks                    -- snapshot av mall vid skapande
  id, instance_id, template_task_id nullable,
  title, description, section,
  assignee_profile_id      nullable,   -- intern mottagare
  assignee_external_id     nullable,   -- extern mottagare
  is_applicable bool default true,
  done bool, done_at, done_by, note

onboarding_email_log
  id, instance_id,
  recipient_profile_id     nullable,
  recipient_external_id    nullable,
  recipient_email          text not null,   -- alltid satt (snapshot)
  task_ids uuid[], sent_at, status
```

---

## 6. Backend (Edge Functions)

- `onboarding-create-from-heartpace` — anropas av heartpace-syncen när ny profil dyker upp; resolvar ansvariga från mallen; skapar tasks; skickar mejlbatch.
- `onboarding-send-task-emails` — grupperar tasks per ansvarig, renderar React Email-mall (samma stack som övriga transaktionsmejl), använder befintlig `send-transactional-email`.
- Mejlmall: subject + intro + bullet-lista över personens punkter + djuplänk till intranätet.

---

## 7. Frontend

- **`/onboarding` (HR-vy)** — lista pågående onboardings, progress per person, klick in → alla uppgifter och var det hänger upp sig, manuell skapa-knapp (för fall utan Heartpace), skicka påminnelse.
- **"Mina onboarding-uppgifter"** — widget på dashboard + flik under `/personal` där användaren ser sina öppna punkter och bockar av.
- **Admin → Onboardingmallar** — redigera tasks, ansvarstyp (välj profil / koppla mot verktygsägare / chef / roll), mejltext med variabler.

### 7.1 Nya admin-sidor

**`/admin/onboarding`** — egen sektion i admin-sidomenyn (ikon: `UserPlus`), grupperad under "Personal". Innehåller flikar:

- **Översikt** — pågående onboardings/offboardings, status, ansvarig chef, antal öppna tasks, nästa förfallodatum.
- **Mallar** — listar `onboarding_templates` (kind = onboarding/offboarding). Redigera tasks: titel, sektion, `assignee_source`, koppling (tool/area/role), `is_optional`, mejlmall.
- **Ansvarsområden** — CRUD för `responsibility_areas` (se 7.2 nedan).
- **Externa kontakter** — CRUD för `external_contacts` (se detaljer nedan).
- **Mejlmallar** — redigera default-mejltexter per task-grupp med variabel-hjälp (`[namn]`, `[verktyg]` osv.).

**`/admin/responsibility-areas`** (sub-route, eller egen flik enligt ovan) — egen sida för **Ansvarsområden**:

```text
┌─ Ansvarsområden ───────────────────────────────────────────┐
│  [+ Nytt ansvarsområde]                  [sök...]          │
│                                                            │
│  Namn                Slug              Ägare       Aktiv   │
│  ─────────────────────────────────────────────────────     │
│  Nycklar & passerkort  keys-access     Christel J.   ✓     │
│  SHF:s webbsida        website-contacts Inga P.      ✓     │
│  Fastighetslistor      property-lists   Christel J.  ✓     │
│                                                            │
│  Klick på rad → drawer med fält + ägarhantering            │
└────────────────────────────────────────────────────────────┘
```

Drawer/dialog för redigering:
- **Grunddata:** namn, slug (auto från namn, redigerbart), beskrivning (kort text), `is_active`-toggle.
- **Ägare:** lista över kopplingar i `responsibility_owners`. Sök/lägg till intern profil **eller** extern kontakt (`external_contacts`). Visar badge "Intern" / "Extern". Flera ägare tillåts.
- **Används av:** läs-bara badges över de mall-tasks som pekar på området (`onboarding_template_tasks.assignee_area_id`), så admin ser konsekvenser innan något inaktiveras.

### Externa kontakter (✅ Levererad i förskott — Etapp 0)

Efter diskussion lyftes **Externa kontakter** ut ur `/admin/onboarding` och placerades istället direkt under **Administration → Organisation** (`/admin`, sektion `external-contacts`). Skälet är att registret även används av andra moduler (i första hand `Verktyg`), och det fanns redan en separat sida för **Externa parter** (inloggningsbara partners via `external_invites`). De två är medvetet separata koncept:

| | **Externa parter** (befintlig) | **Externa kontakter** (ny) |
|---|---|---|
| Syfte | Bjuda in externa partners som ska **logga in** i intranätet | Register över personer som **aldrig loggar in**, bara används som mottagare/ägare |
| Datakälla | `external_invites` + `profiles.is_external = true` | `external_contacts` (ren kontaktrad, ingen auth) |
| Exempel | Konsult som behöver se planner/dokument | Agnes på Fastighetssnabben, revisor, försäkringsmäklare |
| Kostar | En aktiv Supabase-användare per person | Bara en rad i en tabell |

```text
┌─ Externa kontakter ────────────────────────────────────────┐
│  [+ Ny kontakt]                          [sök...]          │
│                                                            │
│  🏢  Agnes Eriksson                                        │
│      Fastighetssnabben AB                                  │
│      ✉ agnes@fastighetssnabben.se  ☎ +46 70 123 45 67     │
│                                              [✎] [🗑]      │
└────────────────────────────────────────────────────────────┘
```

- **Route:** `/admin` → sektion `Externa kontakter` under gruppen **Organisation** (egen kort + sidomeny-länk, ikon: `Contact`).
- **Komponent:** `src/components/admin/ExternalContactsManager.tsx`, lazy-laddad i `src/pages/Admin.tsx`.
- **Data:** tabell `external_contacts` med `company_name`, `full_name` (obligatoriskt), `email`, `phone`, `notes`, `is_active`, `created_by`. Trigger `update_updated_at_column` på UPDATE.
- **CRUD:**
  - **Lista:** kortbaserad (grid 1–2 kolumner), sorterad på `company_name` därefter `full_name`. Inaktiva visas nedtonat (opacity 60%).
  - **Skapa/Redigera:** shadcn `Dialog` med fälten ovan + Aktiv-toggle. `mailto:` / `tel:`-länkar genereras direkt i listan.
  - **Radera:** hård delete med bekräftelse­dialog som varnar att alla `tool_owners`-kopplingar tas bort (FK ON DELETE CASCADE).
- **Sök:** klient­side filter (ingen debounce nödvändig — listan är liten), matchar `company_name`, `full_name`, `email`, `phone`.
- **Validering:** zod-schema (`contactSchema`) — `full_name` 1–120 (trim, krävs), `company_name` 0–120, `email` valid + max 255 (valfri), `phone` 0–40, `notes` 0–1000. Fel visas via `toast.error`.
- **RLS:**
  - **SELECT:** alla inloggade får läsa (behövs för verktygsägar-listor och framtida ansvarsområden).
  - **INSERT/UPDATE/DELETE:** kräver `is_in_admin_group(auth.uid())` ELLER `has_role(auth.uid(), 'admin')` ELLER `has_role(auth.uid(), 'it')`. HR-rollen läggs till när onboarding-modulen byggs.
- **Behörighet i UI:** sektionen är registrerad som admin-only i `useAdminAccess` (slug `null` → endast admin/IT ser kortet i `/admin`). RLS speglar samma villkor på databasnivå.

#### Koppling till verktygsägare (✅ Levererad)

`ToolsManager` och `/verktyg` läser nu både `profile_id` och `external_contact_id` från `tool_owners`. I ägar-pickern visas två tydligt separerade sektioner under rubriken **Systemägare**:

```text
SHF-anställda
  ☑ Anna Andersson
  ☐ Bo Bengtsson
  ...

Externa kontakter
  ☐ Agnes Eriksson · Fastighetssnabben AB
  ☐ Erik Eriksson · Revisionsbyrån
```

Internt representeras varje val som en composite key `"profile:<id>"` eller `"external:<id>"` så att en post entydigt vet vilken tabell den ska skrivas mot. `tools.owner_id` (legacy, NOT NULL togs bort) sätts fortfarande till första interna profilen om någon är vald — annars `NULL`. På `/verktyg` visas externa ägare som "Förnamn Efternamn (Företag)" i samma popover som befintliga ägare.

#### Återstår innan onboarding-modulen

- **Ansvarsområden** (`responsibility_areas` + `responsibility_owners`) — egen flik under `/admin/onboarding` när den byggs. Återanvänder samma två-listors-mönster (interna profiler + externa kontakter) som verktygs­ägar-pickern.
- **Multi-select direkt på en extern kontakt** för att snabbt koppla mot flera områden samtidigt — flyttas till `/admin/onboarding`-fliken när tabellerna finns.
- **Behörighet utökas** med `user_in_group_named(auth.uid(), 'HR')` och `has_module_slug_permission(auth.uid(), 'onboarding-admin', ...)` när onboarding-modulen registreras.

> **Syfte:** Samla alla externa parter på ett ställe utan att blanda in dem i personalkatalogen eller behöva ge dem inloggning. Används idag för Agnes (Fastighetssnabben → Spiris/Collectum) men är generisk för framtida revisorer, försäkringsmäklare m.m. Eftersom registret nu finns klart innan onboarding-modulen byggs kan vi redan börja koppla externa ägare på verktyg — när onboarding-mallarna sedan resolvar `assignee_source = 'tool_owner'` får vi externa mottagare på köpet.


### 7.2 Behörighet
- Bara medlemmar i admin- eller HR-gruppen (samt superadmin) kan nå `/admin/onboarding`.
- Modulen registreras i `modules`-tabellen som `onboarding-admin` så övriga rättigheter (`module_permissions`) fungerar som för andra admin-moduler.
- Lägg till en länk i admin-sidomenyn under "Personal" enligt befintligt mönster (`AdminSidebar`).

> **Status:** endast plan. Implementation görs i Etapp 1 enligt avsnitt 10 — börja med datamodellen + `/admin/onboarding`-skalet och fliken Ansvarsområden, eftersom mallarna förutsätter att områden och externa kontakter finns på plats.

### 7.3 Processflöde (bekräftat 2026-06-11)

Hela onboarding-processen följer en strikt sekvens med två tydliga "grindar" innan ansvariga ägare aktiveras:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ FAS 1 — Närmaste chef initierar                    status: pending_hr │
│   • Chef öppnar /onboarding och klickar "Ny onboarding"              │
│   • Fyller i: namn, startdatum, befattning, ev. Heartpace-koppling   │
│   • Kryssar i vilka "Om aktuellt"-punkter som gäller                 │
│     (tjänstebil, ID06, bank, Creditsafe, iBinder, Metry, ...)        │
│   • Sparar → HR får mejl + in-app-notis: "Ny onboardingansökan"      │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FAS 2 — HR bekräftar                               status: active    │
│   • HR öppnar ärendet från notisen/mejlet                            │
│   • Lägger in personen i Heartpace, kompletterar profildata          │
│   • Klickar "Bekräfta & starta utskick"                              │
│   • Systemet resolvar alla tasks via assignee_source och skapar      │
│     onboarding_tasks-rader (endast för aktuella punkter)             │
│   • Mejl + notis går ut till varje ansvarig (samlat per person)      │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FAS 3 — Ansvariga utför                            status: active    │
│   • Tool-owners / area-owners / chef får mejl med deras egna punkter │
│   • Varje mejl innehåller en länk till ärendet:                      │
│     https://intra.handelsfastigheter.se/onboarding/<instance_id>     │
│     → öppnar deras del av checklistan, redo att kryssas av           │
│   • Påminnelser går ut N dagar innan deadline om något är öppet      │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FAS 4 — Avslut                                     status: completed │
│   • När sista task kryssas av → instansen sätts till completed       │
│   • HR + närmaste chef får mejl + notis: "Onboarding klar för X"     │
└──────────────────────────────────────────────────────────────────────┘
```

**`/onboarding`-sidan** (uppdaterad omfattning):
- **Närmaste chef** ser sina pågående onboardings (där `initiated_by = chef.user_id` eller `nearest_manager_id = chef.profile_id`) med full progress-vy.
- **HR** ser alla onboardings i organisationen, kan filtrera på status (`pending_hr`, `active`, `completed`) och se var det hänger upp sig.
- **Övriga ansvariga** (tool-owners m.fl.) ser bara sina egna tasks via deep-link från mejlet eller via "Mina onboarding-uppgifter" på dashboarden.
- Detalj-vyn (`/onboarding/<id>`) visar timeline med Fas 1–4, alla tasks grupperade per ansvarig, vilka som är klara/öppna/försenade.

**Mejl-design — alla utskick innehåller deep-link tillbaka:**
| Trigger | Mottagare | Innehåll | Länk |
|---|---|---|---|
| Fas 1 → Fas 2 | HR | "Ny onboardingansökan för [namn] från [chef]" | `/onboarding/<id>` |
| Fas 2 → Fas 3 | Varje ansvarig (samlat) | "Du har X onboarding-uppgifter för [namn] inför [startdatum]" | `/onboarding/<id>` (filtrerad på mottagarens tasks) |
| Påminnelse | Ansvarig med öppna tasks | "Påminnelse: [namn] börjar om N dagar" | `/onboarding/<id>` |
| Fas 4 | HR + närmaste chef | "Onboarding klar för [namn]" | `/onboarding/<id>` |

**Datamodells-tillägg:**
- `onboarding_instances.initiated_by uuid` (user_id på chefen som startade) — för "mina onboardings"-filter.
- `onboarding_instances.hr_confirmed_at timestamptz` + `hr_confirmed_by uuid` — markerar övergången Fas 1 → Fas 2.
- `onboarding_instances.optional_items_included jsonb` — vilka "Om aktuellt"-punkter chefen kryssade i (snapshot, så tasks bara skapas för dessa när HR bekräftar).
- `onboarding_instances.completed_at timestamptz` — sätts när sista task bockas av, triggar Fas 4-utskick.



---

## 8. Kopplingar till befintlig kod

- Nuvarande `/onboarding`-orderflöde (dator/mobil/systembehörigheter) **behålls** som "Beställning av utrustning" — det är en av punkterna i checklistan ("Beställ dator och mobil via Onboarding-formuläret"). Vi länkar dit från checklistan istället för att ersätta.
- `tool_owners` används för att auto-tilldela behörighetsuppgifter → mallen självuppdateras vid ägarbyten.

---

## 9. Återanvändning för offboarding

Samma datamodell, separat mall (`kind = 'offboarding'`). Triggas när profil markeras avslutad i Heartpace eller manuellt av HR.

---

## 10. Etapper

**Etapp 0 — Förberedande (✅ levererad)**
- `external_contacts`-tabell + RLS
- `tool_owners` utökad med `external_contact_id` (synthetic PK, CHECK exactly-one, unika index)
- `tools.owner_id` nullable
- Admin-sida `Externa kontakter` under Organisation (CRUD + sök + zod-validering)
- Verktygsägar-pickern visar interna + externa i separata sektioner; `/verktyg` renderar externa ägare med företagsnamn

**Etapp 1 — Fundament**
- Datamodell + admin-vy för mall (förladdad med Petras checklista)
- Manuell "Skapa onboarding"-knapp för HR (utan Heartpace-trigger än)
- Per-ansvarig mejl + checklistevy för mottagare
- HR-dashboard med progress
- **Dynamisk `tool_owner`-resolution** (kärnan i kopplingen till `/verktyg`)

**Etapp 2 — Automatik**
- Heartpace-trigger via befintlig sync
- Variabelinfyllning från Heartpace-data
- In-app-notiser + påminnelser

**Etapp 3 — Offboarding**
- Offboarding-mall, trigger vid avslutad anställning, återlämningschecklista

---

## 11. Öppna frågor (besvara innan bygge)

> **Besvarade 2026-06-10:**
> - ✅ *Vem får initiera?* Alla chefer. Ingen separat rekryteringsrätt-roll i nuläget — kan införas retroaktivt vid behov.
> - ✅ *Timing för chef-tasks?* Inga tasks aktiveras förrän HR bekräftat i Heartpace (Fas 2). Fas 1 är endast registrering, status `pending_hr`.
> - ✅ *Statiska personnamn i mallen?* Nej. Allt auto-härleds via `tool_owner` / `area_owner` / `role` / `nearest_manager`.
> - ✅ *Saker som inte är "verktyg" (nycklar, webbsida, fastighetslistor)?* Läggs som `responsibility_areas` — eget register, syns inte på `/verktyg`.
> - ✅ *Externa personer (Agnes m.fl.)?* Läggs som `external_contacts` och kan stå som ägare på både verktyg och ansvarsområden. Inga inloggningar, ingen plats i personalkatalogen.

1. **Mejlstrategi:** ✅ Ett samlat mejl per ansvarig med alla deras punkter.
2. **Heartpace-trigger:** ✅ Befintlig schemalagd sync (dagligen). Minst 48 h innan startdatum.
3. **"Om aktuellt"-punkter:** ✅ Chefen kryssar i Fas 1. HR bekräftar i Fas 2. Tasks skapas bara för markerade punkter.
4. **In-app-notiser:** ✅ Ja, utöver mejl.
5. **Externa kontakters avbockning:** ✅ Token-länk i mejlet → publik vy där externa bockar av utan inloggning. HR har manuell fallback.
6. **Påminnelse-logik:** ✅ T-7, T-3 och T-1 dagar före startdatum. T-1 eskalerar dessutom till närmaste chef.
7. **Fastighetslistor som löpande process?** Öppen — ska "förändringar i fastighetslistor" trigga vid varje onboarding eller är det en stående uppgift utanför mallen?

---

## 12. Mejlmallar (Petras originaltexter)

Bevaras som default i admin-vyn, redigerbara per task-grupp. Se `Onboarding 2026.docx` för full text. Variabler: `[namn]`, `[startdatum]`, `[befattning]`, `[chef]`, `[ansvarig]`, `[verktyg]`.

---

## 13. Bygg-spec (klar för agenter) — bekräftad 2026-06-11

Detta avsnitt är "kontraktet" mellan plan och implementation. Agenter ska kunna parallellisera arbete utan ytterligare frågor.

### 13.1 Komplett DDL

```sql
-- Enums
CREATE TYPE onboarding_kind AS ENUM ('onboarding', 'offboarding');
CREATE TYPE onboarding_status AS ENUM ('pending_hr', 'active', 'completed', 'cancelled');
CREATE TYPE onboarding_assignee_source AS ENUM ('tool_owner', 'area_owner', 'role', 'nearest_manager');
CREATE TYPE onboarding_task_kind AS ENUM ('standard', 'optional');

-- responsibility_areas
CREATE TABLE public.responsibility_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- responsibility_owners (XOR: intern eller extern)
CREATE TABLE public.responsibility_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES public.responsibility_areas(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  external_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(profile_id, external_contact_id) = 1)
);
CREATE UNIQUE INDEX responsibility_owners_area_profile_uq
  ON public.responsibility_owners(area_id, profile_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX responsibility_owners_area_external_uq
  ON public.responsibility_owners(area_id, external_contact_id) WHERE external_contact_id IS NOT NULL;

-- onboarding_templates
CREATE TABLE public.onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind onboarding_kind NOT NULL DEFAULT 'onboarding',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- onboarding_template_tasks
CREATE TABLE public.onboarding_template_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  section text NOT NULL,
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  kind onboarding_task_kind NOT NULL DEFAULT 'standard',
  optional_key text,                              -- t.ex. 'tjanstebil', 'id06', 'creditsafe'
  assignee_source onboarding_assignee_source NOT NULL,
  assignee_tool_id uuid REFERENCES public.tools(id) ON DELETE RESTRICT,
  assignee_area_id uuid REFERENCES public.responsibility_areas(id) ON DELETE RESTRICT,
  assignee_role text,                              -- 'hr' | 'it'
  email_template_key text,
  due_offset_days int,                             -- relativt start_date (negativ = före)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (assignee_source = 'tool_owner'      AND assignee_tool_id IS NOT NULL) OR
    (assignee_source = 'area_owner'      AND assignee_area_id IS NOT NULL) OR
    (assignee_source = 'role'            AND assignee_role IS NOT NULL) OR
    (assignee_source = 'nearest_manager')
  )
);

-- onboarding_instances
CREATE TABLE public.onboarding_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE RESTRICT,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,  -- nullable: fylls i när profilen finns
  full_name text NOT NULL,                          -- snapshot från Fas 1
  email text,
  position text,
  start_date date NOT NULL,
  initiated_by uuid NOT NULL REFERENCES auth.users(id),
  nearest_manager_id uuid REFERENCES public.profiles(id),
  heartpace_employee_id text,
  status onboarding_status NOT NULL DEFAULT 'pending_hr',
  optional_items_included jsonb NOT NULL DEFAULT '[]'::jsonb,
  hr_confirmed_at timestamptz,
  hr_confirmed_by uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id),
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- onboarding_tasks (snapshot vid Fas 2)
CREATE TABLE public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.onboarding_instances(id) ON DELETE CASCADE,
  template_task_id uuid REFERENCES public.onboarding_template_tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  section text NOT NULL,
  assignee_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_external_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  assignee_email text NOT NULL,                    -- snapshot, alltid satt
  assignee_label text NOT NULL,                    -- "Anna A." eller "Agnes (Fastighetssnabben)"
  deadline_date date,
  reminder_sent_at timestamptz,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by uuid REFERENCES auth.users(id),          -- null om bockad via token (extern)
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- onboarding_external_tokens (engångslänkar för externa)
CREATE TABLE public.onboarding_external_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.onboarding_instances(id) ON DELETE CASCADE,
  external_contact_id uuid NOT NULL REFERENCES public.external_contacts(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,                      -- 64 hex chars (32 random bytes)
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- onboarding_email_log
CREATE TABLE public.onboarding_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.onboarding_instances(id) ON DELETE CASCADE,
  recipient_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_external_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  template_key text NOT NULL,                      -- 'fas2_owner_batch', 'fas4_done', 'reminder', ...
  task_ids uuid[] NOT NULL DEFAULT '{}',
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued'
);
```

### 13.2 RLS-spec + helper-funktioner

Nya security-definer helpers:

```sql
CREATE OR REPLACE FUNCTION public.is_in_hr_group(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = _user_id AND g.name ILIKE 'HR'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_onboarding_task(_user_id uuid, _instance_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.onboarding_tasks t
    JOIN public.profiles p ON p.id = t.assignee_profile_id
    WHERE t.instance_id = _instance_id AND p.user_id = _user_id
  )
$$;
```

Policyöversikt:

| Tabell | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `responsibility_areas` | alla authenticated | admin/IT | admin/IT | admin/IT |
| `responsibility_owners` | alla authenticated | admin/IT/HR | admin/IT/HR | admin/IT/HR |
| `onboarding_templates` | admin/IT/HR | admin/IT/HR | admin/IT/HR | admin/IT |
| `onboarding_template_tasks` | admin/IT/HR | admin/IT/HR | admin/IT/HR | admin/IT/HR |
| `onboarding_instances` | HR + admin/IT + `initiated_by = auth.uid()` + caller är `nearest_manager` + `has_onboarding_task` | chefer (`is_in_manager_group`) | HR/admin/IT + initiator (begränsade fält) | admin/IT |
| `onboarding_tasks` | HR/admin/IT + caller är assignee + initiator/chef för instansen | service_role (edge fn) | mottagaren (done/note) + HR/admin/IT | service_role |
| `onboarding_external_tokens` | service_role only | service_role | service_role | service_role |
| `onboarding_email_log` | HR/admin/IT | service_role | — | admin/IT |

Externa bockar av via `onboarding-external-checkoff` (service-role); tabellen behöver inga publika policys.

### 13.3 Edge Functions (komplett lista)

| Function | Trigger | Ansvar |
|---|---|---|
| `onboarding-initiate` | UI (chef) | Validerar input, skapar instans i `pending_hr`, dubblett-skydd (60 dgr), mejl + notis till HR |
| `onboarding-hr-confirm` | UI (HR) | Resolvar `assignee_source` → snapshottar tasks (hoppar över optional där `optional_key` inte finns i `optional_items_included`), genererar tokens för externa, batchar mejl per mottagare, skickar notiser |
| `onboarding-task-checkoff` | UI (intern) | Markerar task done, anropar complete-check |
| `onboarding-external-checkoff` | publik (`verify_jwt=false`) | Validerar token, listar/markerar tasks för extern mottagare |
| `onboarding-complete-check` | inifrån checkoff | Om alla tasks done → sätt `completed_at`, skicka Fas 4-mejl till HR + chef |
| `onboarding-reminders` | pg_cron dagligen 07:00 | För aktiva instanser där `start_date - today` ∈ {7,3,1} och tasks öppna → batch-påminnelser. T-1 eskalerar till chef. |
| `onboarding-cancel` | UI (HR/admin) | Sätt `cancelled_at`, `cancel_reason`; mejl + notis till alla involverade; tokens invalideras logiskt |

Alla mejlutskick går via `send-transactional-email`. Endast `onboarding-external-checkoff` har `verify_jwt = false`.

### 13.4 React Email-mallar (props-kontrakt)

Registreras i `supabase/functions/_shared/transactional-email-templates/registry.ts`.

```ts
// onboarding-hr-new-application
interface Props {
  instanceId: string;
  fullName: string;
  position?: string;
  startDate: string;       // ISO
  initiatedByName: string;
  optionalItems: string[];
  deepLink: string;        // /onboarding/<id>
}

// onboarding-owner-task-batch  (Fas 2 → 3)
interface Props {
  instanceId: string;
  recipientFirstName: string;
  newHireName: string;
  startDate: string;
  position?: string;
  managerName: string;
  tasks: { title: string; description?: string; deadline?: string }[];
  deepLink: string;        // /onboarding/<id>?focus=mine
  externalToken?: string;  // sätts om mottagaren är extern → deepLink = /onboarding/extern?token=...
}

// onboarding-reminder
interface Props {
  instanceId: string;
  recipientFirstName: string;
  newHireName: string;
  startDate: string;
  daysUntilStart: 7 | 3 | 1;
  openTasks: { title: string }[];
  deepLink: string;
  escalatedToManager?: boolean;  // true vid T-1 till chef
}

// onboarding-completed
interface Props {
  instanceId: string;
  newHireName: string;
  startDate: string;
  deepLink: string;
}

// onboarding-cancelled
interface Props {
  instanceId: string;
  newHireName: string;
  cancelReason: string;
  cancelledByName: string;
}
```

### 13.5 Påminnelse-logik (definitiv)

- pg_cron-jobb `onboarding-daily-reminders` kör 07:00 Europe/Stockholm.
- För varje `onboarding_instances` med `status = 'active'`:
  - Beräkna `days_until_start = start_date - current_date`.
  - Om `days_until_start ∈ {7, 3, 1}`: batcha öppna tasks per mottagare → `onboarding-reminder`-mejl + in-app-notis. Sätt `reminder_sent_at = now()` på berörda tasks.
  - Om `days_until_start = 1`: skicka även ett separat eskaleringsmejl till `nearest_manager_id` med listan över **alla** öppna tasks (`escalatedToManager = true`).
- Dedupe: max en påminnelse per mottagare per dygn (`reminder_sent_at >= today`).

### 13.6 Externa kontakters avbockning (definitiv)

- Vid Fas 2-utskick: en rad i `onboarding_external_tokens` per extern mottagare. `token = encode(gen_random_bytes(32), 'hex')`. `expires_at = start_date + interval '30 days'`.
- Mejlet länkar till `/onboarding/extern?token=<token>`.
- Publik route `/onboarding/extern` (ingen auth):
  - GET → `onboarding-external-checkoff` action `load` → returnerar instans-snapshot + öppna tasks för mottagaren.
  - POST → action `check`, taskId → sätter `done=true`, `done_by=null`, `note='ext:<external_contact_id>'`.
- Token är giltig tills `expires_at` eller tills instansen är `completed`/`cancelled`. Samma token täcker alla mottagarens tasks (engångsbrukas inte per task).
- HR-fallback: kan manuellt markera externa tasks som klara i `/onboarding/<id>` om den externa inte svarar.

### 13.7 Edge cases (definierat beteende)

| Case | Beteende |
|---|---|
| HR avbryter onboarding | `onboarding-cancel` sätter `cancelled_at`. Öppna tasks fryses (grå). Alla med öppna tasks får notis + `onboarding-cancelled`-mejl. Tokens slutar gälla. |
| Task-mottagare slutar mitt i (profil inaktiveras) | `onboarding-reminders` omresolvar mot aktuell `tool_owner`/`area_owner`, uppdaterar `assignee_*`-fält + loggar `template_key='reassigned'`. Saknas ny ägare → HR notifieras. |
| Chef vill lägga till "Om aktuellt"-punkt efter Fas 2 | `/onboarding/<id>` har knappen "Lägg till uppgift" (chef/HR). Väljer `optional_key` som saknades → nya tasks skapas, resolvas direkt, mejl går ut. `optional_items_included` uppdateras. |
| Heartpace skapar profil efter Fas 1 | Befintlig sync matchar på `email` → uppdaterar `onboarding_instances.profile_id`. Redan resolverade tasks påverkas inte (snapshot). |
| Tool får ny ägare under pågående onboarding | Snapshot → öppna tasks oförändrade. Nya onboardings använder nya ägaren. |
| Mottagare saknar email | `onboarding-hr-confirm` validerar; saknas → instansen går till `active`, men `assignee_email='MISSING'` flaggas röd i UI och HR notifieras. |
| Token-mejl studsar | `suppressed_emails` blockerar omsändning. HR ser status och bockar manuellt. |
| Dubbel-initiering | `onboarding-initiate` blockerar om aktiv instans finns med samma `email` + `start_date` inom 60 dagar. |

### 13.8 Föreslagen agent-split (parallellt körbar)

- **Agent A — Datamodell & RLS:** migrationer enligt 13.1 + 13.2. **Blockerar B–F** (regenererar `types.ts`).
- **Agent B — Edge Functions:** alla 7 funktioner i 13.3 + `config.toml` för `onboarding-external-checkoff`. Beroende: A.
- **Agent C — React Email-mallar:** 5 mallar enligt 13.4 + `registry.ts`. Parallellt med B.
- **Agent D — Admin-UI:** `/admin/onboarding` (Översikt, Mallar, Ansvarsområden, Mejlmallar). Parallellt med B/C.
- **Agent E — `/onboarding`-vyer:** chef-init-formulär, HR-bekräftelse, detalj-vy med timeline, "Mina onboarding-uppgifter"-widget, publik `/onboarding/extern`. Beroende: A.
- **Agent F — pg_cron + notiser:** schemaläggning av `onboarding-reminders` via `cron.schedule` (projekt-URL + anon key), hookar i `notifications`. Beroende: B.

**Klart för bygge:** ja, så snart fråga 7 (fastighetslistor) är besvarad eller medvetet skjuten till efter Etapp 1.
