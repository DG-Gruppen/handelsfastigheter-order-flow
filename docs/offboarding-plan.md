# Offboarding-plan

> Speglar `docs/onboarding-plan.md` och **återanvänder samma tabeller, RLS-helpers, mejl-pipe och admin-komponenter** via `kind = 'offboarding'`. Det här dokumentet beskriver bara skillnaderna och de additiva schema-deltan offboarding lägger till.
>
> Senast uppdaterad: 2026-06-11 (synkad end-to-end med onboarding-planen)

## 1. Mål

Ett samlat flöde när en medarbetare slutar: HR/chef triggar, ansvariga får uppgifter automatiskt, system-konton stängs, hårdvara/licenser återlämnas, sista lön och slutsamtal hanteras — utan att någon glöms bort.

## 2. Trigger

Två vägar in (parallellt med onboarding):

1. **Manuell start** (primär i fas 1) — HR eller chef öppnar `/offboarding/new`, väljer person, slutdatum, orsak (egen uppsägning / arbetsgivarens / pension / annat), och om utträdet är *normalt* eller *snabbavslut* (samma dag).
2. **Heartpace-signal** (förberedd i fas 1, aktiveras i fas 2) — när `heartpace-sync-personnel` ser ett nytt `slutdatum` på en profil skapas ett utkast-instans automatiskt och HR får notis "Bekräfta offboarding för X".

Trigger-källan loggas i `onboarding_instances.trigger_source` (`'manual' | 'heartpace'`).

## 3. Datamodell — delad med onboarding

**Vi skapar inga `offboarding_*`-tabeller.** Allt går i de befintliga `onboarding_*`-tabellerna (§ 13.1 i onboarding-planen), filtrerat via `onboarding_templates.kind = 'offboarding'`. Det följer den ursprungliga designen i onboarding-planens § 5/9 ("Samma datamodell, separat mall").

### 3.1 Additiva schema-deltan offboarding lägger till

```sql
-- Utöka instans-tabellen med offboarding-specifika fält
ALTER TABLE public.onboarding_instances
  ADD COLUMN trigger_source text NOT NULL DEFAULT 'manual'
    CHECK (trigger_source IN ('manual', 'heartpace')),
  ADD COLUMN last_day date,                     -- krävs när kind = 'offboarding'
  ADD COLUMN exit_reason text                   -- 'voluntary' | 'employer' | 'retirement' | 'other'
    CHECK (exit_reason IN ('voluntary','employer','retirement','other') OR exit_reason IS NULL),
  ADD COLUMN exit_type text                     -- 'normal' | 'immediate'
    CHECK (exit_type IN ('normal','immediate') OR exit_type IS NULL),
  ADD COLUMN legal_hold boolean NOT NULL DEFAULT false;  -- stoppar arkivering

-- Validering: när kind='offboarding' krävs last_day; när kind='onboarding' krävs start_date
CREATE OR REPLACE FUNCTION public.onboarding_instance_validate()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k onboarding_kind;
BEGIN
  SELECT kind INTO k FROM public.onboarding_templates WHERE id = NEW.template_id;
  IF k = 'offboarding' AND NEW.last_day IS NULL THEN
    RAISE EXCEPTION 'last_day krävs för offboarding-instans';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_onboarding_instance_validate
  BEFORE INSERT OR UPDATE ON public.onboarding_instances
  FOR EACH ROW EXECUTE FUNCTION public.onboarding_instance_validate();

-- Utöka mall-task med offboarding-specifika fält
ALTER TABLE public.onboarding_template_tasks
  ADD COLUMN category text,                     -- 'system' | 'hardware' | 'access' | 'hr' | 'finance' | 'social' | (null = onboarding-section)
  ADD COLUMN conditional text NOT NULL DEFAULT 'always';  -- 'always' | 'if_company_car' | 'if_keys' | 'if_phone' | ...

-- due_offset_days finns redan; för offboarding räknas det från last_day, för onboarding från start_date
-- (resolvas i edge function vid Fas 2)

-- Koppling order → offboarding-instans (för "pågående beställningar som leaver har"-vyn)
ALTER TABLE public.orders
  ADD COLUMN offboarding_instance_id uuid NULL
    REFERENCES public.onboarding_instances(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_offboarding_instance ON public.orders(offboarding_instance_id)
  WHERE offboarding_instance_id IS NOT NULL;
```

### 3.2 Vad som **inte** ändras (återanvänds rakt av)

| Komponent | Återanvänds från onboarding |
|---|---|
| `onboarding_templates` (med `kind='offboarding'`) | ✓ |
| `onboarding_template_tasks` med `assignee_source` enum | ✓ (`tool_owner`, `area_owner`, `role`, `nearest_manager`) |
| `onboarding_tasks` (snapshot vid Fas 2) | ✓ — inkl. `done`, `done_at`, `note` |
| `onboarding_external_tokens` (token-flöde för externa) | ✓ — Agnes på Spiris/Collectum stänger sina konton via samma `/onboarding/extern`-vy |
| `onboarding_email_log` | ✓ — `template_key` får nya värden (`offboarding-*`) |
| RLS-helpers `is_in_hr_group`, `has_onboarding_task` | ✓ |
| `responsibility_areas` + `responsibility_owners` | ✓ — nycklar/passerkort pekar hit precis som i onboarding |
| `external_contacts` | ✓ |

> **Konsekvens:** Inga nya admin-flikar för "Offboarding-ansvarsområden" eller "Offboarding-externa kontakter" — samma register driver båda flödena. Mall-editorn under `/admin/onboarding` får en `kind`-toggle överst.

## 4. Mall — utgångsläge

Kategoriserat efter ansvarig. Allt ägarskap löses via `assignee_source` (inga statiska namn — samma princip som onboarding § 2).

### System & licenser (`assignee_source = 'tool_owner'`)
En rad per system; ägaren av verktyget får uppgiften. Täcker: Google Workspace, Heartpace, Rillion, Vitec/3L, Rekyl, IT-hotellet, Creditsafe, Momentum, Webport, Bereko, iBinder, Metry, Vyer, Zendesk, Uniguide, Spiris, Collectum, Bank.

Standardtask per system: *"Avsluta [verktyg]-konto för [namn] senast [last_day + 1]"*. Externa ägare (t.ex. Agnes → Spiris/Collectum) får token-länk till `/onboarding/extern` via samma flöde som onboarding använder.

### Hårdvara, passage & nycklar (`area_owner`)
- `keys-access` (Nycklar & passerkort) — återlämning på `last_day`
- Återta dator, telefon, headset, kreditkort — `area_owner` på nytt område `equipment-return` (eller `role: it` om man hellre håller det på roll-nivå)
- I framtida `equipment`-modul: samma task uppdaterar `status='returned'` på tilldelad utrustning

### HR & ekonomi (`assignee_source = 'role'`, `assignee_role = 'hr'`)
- Sluttidsrapport / semestersaldo
- Sista lön + semesterersättning
- Avregistrera försäkringar, Collectum, friskvård
- Uppdatera anställningsförteckning
- Skicka tjänstgöringsbetyg (om begärt)

### Chef (`assignee_source = 'nearest_manager'`)
- Slutsamtal / exit-intervju
- Avtacka i teamet (mejl/lunch/blomma)
- Fördela pågående ärenden
- Uppdatera org-chart
- Hantera ev. subordinates (om leaver är chef): flytta `manager_id`-pekare till ny chef

### Konditionella (visas bara om `conditional` matchar)
- `if_company_car` — återlämning + drivmedelskort
- `if_remote_equipment` — hemmakontor-utrustning
- `if_external_access` — externa systembehörigheter hos kund
- `if_keys` — extra nycklar utöver standard

HR markerar ej-tillämpliga punkter som `done=true, note='N/A'` direkt vid Fas 2, motsvarande onboardingens `optional_items_included`.

## 5. Återlämning — egen checklista, inte order

Till skillnad från onboarding (där hårdvara/licens hanteras via `/orders/new` och `onboarding_instance_id`) hanteras återlämning **direkt i instansen** via `onboarding_tasks`:

- Varje hårdvaru-/system-uppgift har kryssruta + `note`-fält ("status", "skick", "lämnad till X")
- Ingen `orders`-rad skapas, ingen godkännandekedja, inget `offboarding_instance_id` används vid återlämning
- Motivering: återlämning saknar pris/leverans/godkännande-aspekt och passar bättre som task än som order

**`orders.offboarding_instance_id` används bara för att lista pågående *köp*-ordrar** som personen som slutar har lagt (avsnitt 10, edge case 6) — inte för återlämningen i sig.

Om vi i framtiden inför en `equipment`-modul (tilldelad utrustning per profil) ska de raderna istället uppdateras till `status = 'returned'` av samma uppgift.

## 6. Tidslinje

`due_offset_days` räknas från `last_day` när `kind='offboarding'` (resolvas i `onboarding-hr-confirm`):

| Offset | Exempel |
|---|---|
| -14 | Slutsamtal bokas, avtacknings-planering |
| -7 | Bekräfta återlämningslista med medarbetaren |
| -3 | Påminnelse till alla system-ägare (utöver cron) |
| 0 (sista dagen) | Återlämna hårdvara, nycklar, kort. Inaktivera Google-konto kl 17:00 |
| +1 | Avsluta licenser i alla system |
| +7 | Sista lön körd |
| +30 | Arkivera mejl/Drive, ta bort från grupper |
| +90 | Slutrensning (radera arkiv om `legal_hold = false`) |

## 7. Mejl & notiser

Återanvänd onboarding-pipen (`send-transactional-email`, `onboarding_email_log`, daglig cron).

### 7.1 Nya React Email-mallar (props-kontrakt)

Speglar onboarding-mallarnas struktur (§ 13.4 i onboarding-planen). Registreras i samma `registry.ts`.

| Template key | Mottagare | Trigger |
|---|---|---|
| `offboarding-hr-new` | HR | Manuell start av chef (motsv. `onboarding-hr-new-application`) eller Heartpace-utkast |
| `offboarding-owner-task-batch` | Tool-/area-owner, chef, extern (token) | Fas 2 → 3 (HR bekräftar) |
| `offboarding-reminder` | Ansvarig med öppna tasks | Cron, offset-baserad (T-3, T-0, T+1) |
| `offboarding-completed` | HR + chef | Sista task avbockad |
| `offboarding-cancelled` | Alla med öppna tasks | HR avbryter (medarbetaren stannar) |

Props är identiska med onboarding-motsvarigheterna förutom att `startDate` ersätts av `lastDay` och `daysUntilStart` av `daysUntilExit`.

## 8. UI

- `/offboarding` — HR-lista (aktiva, kommande, avslutade). Återanvänder samma listkomponent som `/onboarding` med `kind`-filter.
- `/offboarding/new` — formulär (person, slutdatum, orsak, exit_type, notes, conditional-kryss)
- `/offboarding/:id` — instansvy med uppgifter grupperade per kategori + ansvarig, kryssrutor + fritext. Samma komponent som `/onboarding/:id` med `kind`-anpassad timeline.
- `/admin/onboarding` — *befintlig sida*, får en `kind`-toggle (Onboarding / Offboarding) överst i flikarna **Översikt** och **Mallar**. Ansvarsområden, Externa kontakter och Mejlmallar är delade.

Sidofält: under "HR" tillsammans med onboarding. Endast HR-grupp + admin ser sektionen.

## 9. Säkerhet / RLS

Återanvänder helpers `is_in_hr_group` och `has_onboarding_task` från onboarding-planen § 13.2. Inga nya helpers behövs.

Tillägg/avvikelser:
- Den som slutar (`onboarding_instances.profile_id` när `kind='offboarding'`) **får inte själv läsa instansen** — slutsamtal och orsak är känsliga. Lägg till villkor i SELECT-policyn: om `kind='offboarding'` exkluderas raden där `auth.uid() = profiles.user_id WHERE profiles.id = instance.profile_id`.
- Chef (nearest manager) ser översikt + tasks men inte ev. konfidentiella note-fält märkta `is_sensitive=true` (framtida fält, fas 2).
- RLS-policy för `orders.offboarding_instance_id` speglar onboarding-motsvarigheten:

```sql
CREATE POLICY "Offboarding-deltagare ser kopplad order"
ON public.orders FOR SELECT TO authenticated
USING (
  offboarding_instance_id IS NOT NULL
  AND (
    public.is_in_hr_group(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.onboarding_instances oi
      WHERE oi.id = orders.offboarding_instance_id
        AND (oi.initiated_by = auth.uid()
             OR EXISTS (SELECT 1 FROM public.profiles p
                        WHERE p.id = oi.nearest_manager_id AND p.user_id = auth.uid()))
    )
    OR public.has_onboarding_task(auth.uid(), offboarding_instance_id)
  )
);
```

## 10. Edge cases

1. **Snabbavslut samma dag** (`exit_type='immediate'`) — alla system-uppgifter får `due_date = today`, Google-konto inaktiveras omedelbart, chef notifieras direkt.
2. **Pensionering** — `legal_hold` kan sättas av HR; arkivering hålls längre (5 år), avtackning prioriteras.
3. **Återanställning innan slutdatum** — HR sätter `status='cancelled'`, `cancel_reason`, alla öppna tasks fryses (samma flöde som onboarding-cancel).
4. **Förlängt slutdatum** — `last_day` uppdateras → `onboarding-hr-confirm` räknar om `deadline_date` på öppna tasks (`done=false`).
5. **Tvist / juridik** — `legal_hold=true` på instansen stoppar arkiverings-tasken tills HR släpper.
6. **Personen har pågående orders i `/orders`** — visas i instansvyn ("Pågående beställningar att hantera"). Chef beslutar fullfölj/annullera. Kopplas via `orders.offboarding_instance_id` som HR sätter manuellt i instansvyn.
7. **Personen är chef för andra** — task till HR + ny chef: flytta `manager_id`-pekare för subordinates. Edge function `offboarding-reassign-subordinates` kan hjälpa till.
8. **Tool får ny ägare under pågående offboarding** — snapshot → öppna tasks oförändrade (samma som onboarding edge case).
9. **Heartpace markerar tidigare leaver som aktiv igen** — befintlig sync skapar/uppdaterar inte automatiskt; HR får notis "Möjlig återanställning för X" och beslutar manuellt.

## 11. Genomförande — agenter

Bygg **efter** att onboarding-fas-1 (Agent A–G i `docs/onboarding-plan.md`) är levererad, så vi får återanvända samma tabeller, komponenter och mejl-pipe.

```text
A-off (additiv schema: ALTER på 3 befintliga tabeller + validate-trigger + orders.offboarding_instance_id + RLS-tillägg)
   │
   ├─► B-off (edge functions: offboarding-initiate, -hr-confirm, -task-checkoff,
   │          -reminders, -cancel, -complete-check, -reassign-subordinates)
   ├─► C-off (mejl-mallar: 5 nya React Email-templates + registry-uppdatering)
   ├─► D-off (admin-UI: kind-toggle i befintlig /admin/onboarding mall-editor)
   ├─► E-off (HR-UI: /offboarding, /offboarding/new, /offboarding/:id —
   │          återanvänder onboarding-komponenter med kind-prop)
   └─► F-off (Heartpace-trigger: utvidga heartpace-sync-personnel med
              slutdatum-detektion → skapar utkast-instans + notis till HR)
```

A-off blockar resten (regenererad `types.ts`). C-off och D-off kan köras parallellt med B-off. E-off förutsätter A-off + befintliga onboarding-komponenter från onboarding-plan Agent E.

## 12. Öppna frågor

1. Ska den som slutar få ett eget mejl med "checklista för dig" (lämna in saker, byt privat mejl i Heartpace, etc.)? Ny template `offboarding-leaver-checklist`?
2. Default-arkivering: 90 dagar standard, 5 år vid pensionering, `legal_hold` blockerar — bekräftas?
3. Ska slutsamtals-anteckningar lagras i instansen (känsligt → kräver `is_sensitive`-fält på `onboarding_tasks.note`) eller bara markeras "genomfört"?
4. Ska vi automatiskt skapa ett planner-kort i HR-boarden per offboarding för översikt?
5. Behövs "återrapportering" till chefen efter 30 dagar (allt klart, inget hänger)?
6. Ska `offboarding-reassign-subordinates` köras automatiskt med "föreslagen ny chef = leavers manager" eller alltid kräva HR-input?

---

## Synk-kontrakt mot `docs/onboarding-plan.md`

Detta dokument är giltigt så länge följande är sant i onboarding-planen:

- `onboarding_kind`-enumet innehåller `'offboarding'` ✓ (§ 13.1)
- `assignee_source`-enumet innehåller `tool_owner`, `area_owner`, `role`, `nearest_manager` ✓ (§ 13.1)
- `onboarding_external_tokens` + `/onboarding/extern` är generiska (inte hårdkodade mot onboarding-text) ✓ (§ 13.6)
- `responsibility_areas` och `external_contacts` är delade register ✓ (§ 2, § 5)
- RLS-helpers `is_in_hr_group` och `has_onboarding_task` är delade ✓ (§ 13.2)

Bryts något av ovanstående måste detta dokument uppdateras samtidigt.
