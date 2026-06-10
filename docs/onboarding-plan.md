# Onboarding / Offboarding — Plan

> Levande dokument. Vi itererar här innan kod skrivs.
> Senast uppdaterad: 2026-06-10

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

external_contacts
  id, name, email, organization, role_description, is_active

responsibility_areas              -- icke-system, t.ex. nycklar, webbsida
  id, slug, name, description, is_active

responsibility_owners             -- many-to-many; ägaren är intern ELLER extern
  id, area_id,
  profile_id          nullable,
  external_contact_id nullable,
  CHECK (num_nonnulls(profile_id, external_contact_id) = 1)

-- tool_owners utökas på samma sätt:
tool_owners (befintlig, ALTER)
  + external_contact_id nullable
  + CHECK (num_nonnulls(profile_id, external_contact_id) = 1)

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

### Externa kontakter (flik)

Samma sida (`/admin/onboarding`), fliken **Externa kontakter**:

```text
┌─ Externa kontakter ────────────────────────────────────────┐
│  [+ Ny extern kontakt]                    [sök...]         │
│                                                            │
│  Namn                Organisation      Roll                │
│  ─────────────────────────────────────────────────────   │
│  Agnes Eriksson      Fastighetssnabben IT-drift            │
│                                                            │
│  Klick på rad → drawer med redigering + kopplade ägarskap   │
└────────────────────────────────────────────────────────────┘
```

Drawer/dialog för redigering:
- **Grunddata:** namn, e-post (obligatorisk, unik), organisation (fritext), rollbeskrivning (kort text), `is_active`-toggle.
- **Kopplade ägarskap:** läs-bara lista över alla `tool_owners` och `responsibility_owners` där kontakten står som ägare, med länkar till respektive verktyg/område. Gör det enkelt att se *varför* en kontakt finns i systemet och vilka mejl hen mottar.
- **Användningshistorik:** antal pågående/completed onboardings där kontakten är ansvarig (via snapshot i `onboarding_tasks` + `onboarding_email_log`).

> **Syfte:** Samla alla externa parter på ett ställe utan att blanda in dem i personalkatalogen eller behöva ge dem inloggning. Används idag för Agnes (Fastighetssnabben → Spiris/Collectum) men är generisk för framtida revisorer, försäkringsmäklare m.m. E-postadressen är nyckeln för utskick — ändras den uppdateras framtida mallar automatiskt. Pågående onboardings påverkas inte pga snapshot i `onboarding_tasks`.


### 7.2 Behörighet
- Bara medlemmar i admin- eller HR-gruppen (samt superadmin) kan nå `/admin/onboarding`.
- Modulen registreras i `modules`-tabellen som `onboarding-admin` så övriga rättigheter (`module_permissions`) fungerar som för andra admin-moduler.
- Lägg till en länk i admin-sidomenyn under "Personal" enligt befintligt mönster (`AdminSidebar`).

> **Status:** endast plan. Implementation görs i Etapp 1 enligt avsnitt 10 — börja med datamodellen + `/admin/onboarding`-skalet och fliken Ansvarsområden, eftersom mallarna förutsätter att områden och externa kontakter finns på plats.

---

## 8. Kopplingar till befintlig kod

- Nuvarande `/onboarding`-orderflöde (dator/mobil/systembehörigheter) **behålls** som "Beställning av utrustning" — det är en av punkterna i checklistan ("Beställ dator och mobil via Onboarding-formuläret"). Vi länkar dit från checklistan istället för att ersätta.
- `tool_owners` används för att auto-tilldela behörighetsuppgifter → mallen självuppdateras vid ägarbyten.

---

## 9. Återanvändning för offboarding

Samma datamodell, separat mall (`kind = 'offboarding'`). Triggas när profil markeras avslutad i Heartpace eller manuellt av HR.

---

## 10. Etapper

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

1. **Mejlstrategi:** Ett samlat mejl per ansvarig med alla deras punkter — bekräfta?
2. **Heartpace-trigger:** Befintlig schemalagd sync (dagligen) räcker, eller behöver vi webhook för snabbare reaktion?
3. **"Om aktuellt"-punkter** (tjänstebil, ID06, bank, Creditsafe, iBinder, Metry): kryssas av HR vid start, eller skapas alltid och ansvarig markerar "ej aktuellt"?
4. **In-app-notiser** utöver mejl? (Vi har redan `notifications`-tabellen.)
5. **Fastighetslistor som löpande process?** Ska "förändringar i fastighetslistor" trigga vid varje onboarding, eller är det en stående uppgift som inte hör hemma i mallen?

---

## 12. Mejlmallar (Petras originaltexter)

Bevaras som default i admin-vyn, redigerbara per task-grupp. Se `Onboarding 2026.docx` för full text. Variabler: `[namn]`, `[startdatum]`, `[befattning]`, `[chef]`, `[ansvarig]`, `[verktyg]`.
