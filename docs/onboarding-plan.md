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

**Princip:** Inga personnamn hårdkodas i mallen. Word-dokumentets namnlista (Petra, Emma, Marit, Wilma, Jörgen, Pernilla, Erika, Christel, Inga, Agnes m.fl.) speglar bara **vem som råkar vara systemägare idag** — och de finns redan registrerade som ägare på respektive verktyg i `/verktyg` (`tool_owners`).

Mallen pekar därför på **roll, verktyg eller relation**, inte på person:

| Källa | Används för | Exempel från Word-dokumentet |
|---|---|---|
| `role: hr` | HR-uppgifter (avtal, försäkringar, Heartpace-registrering, anställningsförteckning) | Petra |
| `tool_owner` (via `tool_id`) | Allt som rör behörighet/upplägg i ett specifikt system | Rillion, Vitec/3L, Rekyl, IT-hotellet, Bank, Creditsafe, Momentum, Webport, Bereko, iBinder, Metry, Vyer, Zendesk, Uniguide, Spiris, Collectum, Webbsida, Nycklar/passerkort, What's Up Kris, Fastighetslistor |
| `nearest_manager` | Allt chefen själv ska göra | Välkomstmejl, lunch, blomma, introduktion, info till org |
| `role: it` | Generiska IT-uppgifter (dator, mobil, konton) | Hanteras via `/onboarding`-orderflödet |

Allt som i Word-dokumentet är taggat på en specifik person (Christel → nycklar, Inga → webbsida, Agnes → Spiris/Collectum osv.) mappas via att **det "verktyget" finns i `/verktyg`** och att personen står som `tool_owner`. Saknas något som verktyg så skapas det där — det är enda stället där "ägaren" definieras.

**Konsekvens:** Byter SHF systemägare i `/admin → Verktyg` följer alla framtida onboardings/offboardings med automatiskt. Word-dokumentet behöver aldrig synkas mot koden.

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

| `assignee_source` | Betydelse | Exempel |
|---|---|---|
| `tool_owner` | Slå upp ägare(n) till verktyg `tool_id` | "Behörighet i Creditsafe" → ägaren i `tools` |
| `nearest_manager` | Nyanställdas chef från Heartpace | "Boka lunch första dagen" |
| `role` | Härled från grupp (HR-grupp, IT-grupp) | "Lägg upp i Heartpace" → HR-gruppen |

> **`static_profile` används inte i mallarna.** Vi tillåter inte att en enskild persons namn skrivs in på en mall-task — det skulle återskapa Word-dokumentets underhållsproblem. Behövs en specifik person som ansvarig så är hen ägare till motsvarande verktyg, punkt.

### Vinster
- Byter man systemägare i `/admin → Verktyg` ändras automatiskt vem som får framtida onboarding-mejl — ingen mall att uppdatera.
- Flera ägare per verktyg (`tool_owners` är many-to-many) → flera mottagare för samma uppgift utan dubbletter.
- Mallen blir kortare och **personoberoende**: en rad per verktyg som pekar på `tool_id`, systemet grupperar mejlen per ansvarig vid utskick.
- Snapshot vid skapande: när en onboarding-instans skapas resolvas alla `assignee_source` till konkreta `assignee_profile_id` på taskraden, så senare ägarbyten **inte** påverkar pågående onboardings.

### Mejlmallens placeholders utökas
- `[verktyg]` — verktygets namn (för `tool_owner`-tasks)
- `[ansvarig]` — mottagarens förnamn
- Befintliga: `[namn]`, `[startdatum]`, `[befattning]`, `[chef]`

### Förutsättningar i `/verktyg` innan mallen kan rullas ut
Varje system/uppgift som Word-dokumentet räknar upp behöver finnas som verktyg med rätt ägare. Lista att checka av:

- **System med befintlig ägare:** Rillion, Vitec/3L, Rekyl, IT-hotellet, Bank, Creditsafe, Momentum, Webport, Bereko, iBinder, Metry, Vyer, Zendesk, Uniguide, Spiris, Collectum.
- **Behöver troligen läggas till som "verktyg" i `/verktyg`** för att kunna auto-härleda:
  - SHF:s webbsida (kontaktuppgifter)
  - Nycklar & passerkort
  - What's Up Kris
  - Fastighetslistor

När dessa finns med ägare räcker det att mallen pekar på `tool_id` — inga personnamn någonstans.

### Mall-rader som inte är `tool_owner`
- HR-arbete (avtal, försäkringar, anställningsförteckning, Heartpace-registrering) → `role: hr`
- Närmaste chefs-uppgifter (välkomstmejl, lunch, blomma, introduktion, info till org) → `nearest_manager`

---

## 5. Datamodell

```text
onboarding_templates
  id, name, kind ('onboarding' | 'offboarding'), is_active

onboarding_template_tasks
  id, template_id, section, title, description, sort_order,
  assignee_source,               -- 'tool_owner' | 'nearest_manager' | 'role'
  assignee_tool_id     nullable, -- för tool_owner
  assignee_role        nullable, -- för role (t.ex. 'hr', 'it')
  is_optional          bool,     -- "om aktuellt"
  email_template_key   nullable  -- om vi vill ha tasks-specifik mejltext

onboarding_instances
  id, profile_id (nyanställd), template_id,
  start_date, position, manager_id,
  heartpace_employee_id, status, created_at, completed_at

onboarding_tasks   -- snapshot av mall vid skapande
  id, instance_id, template_task_id (nullable),
  title, description, section,
  assignee_profile_id,
  is_applicable bool default true,    -- HR/ansvarig kan markera "ej aktuellt"
  done bool, done_at, done_by, note

onboarding_email_log
  id, instance_id, recipient_profile_id, task_ids uuid[],
  sent_at, status
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
> - ✅ *Statiska personnamn i mallen?* Nej. Allt auto-härleds från `tool_owners` / `role` / `nearest_manager`. Saknade "verktyg" (webbsida, nycklar, What's Up Kris, fastighetslistor) läggs upp i `/verktyg` med ägare.

1. **Mejlstrategi:** Ett samlat mejl per ansvarig med alla deras punkter — bekräfta?
2. **Heartpace-trigger:** Befintlig schemalagd sync (dagligen) räcker, eller behöver vi webhook för snabbare reaktion?
3. **"Om aktuellt"-punkter** (tjänstebil, ID06, bank, Creditsafe, iBinder, Metry): kryssas av HR vid start, eller skapas alltid och ansvarig markerar "ej aktuellt"?
4. **In-app-notiser** utöver mejl? (Vi har redan `notifications`-tabellen.)
5. **Fastighetslistor som löpande process?** Ska "förändringar i fastighetslistor" trigga vid varje onboarding, eller är det en stående uppgift som inte hör hemma i mallen?

---

## 12. Mejlmallar (Petras originaltexter)

Bevaras som default i admin-vyn, redigerbara per task-grupp. Se `Onboarding 2026.docx` för full text. Variabler: `[namn]`, `[startdatum]`, `[befattning]`, `[chef]`, `[ansvarig]`, `[verktyg]`.
