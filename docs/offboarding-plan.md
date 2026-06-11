# Offboarding-plan

> Speglar `docs/onboarding-plan.md`. När en mekanism beskrivs där (mall-uppgifter med `assignee_source`, ägar-resolvning via `tool_owners`, batch-mejl per ansvarig, påminnelse-cron, HR-vy) återanvänds samma byggstenar här — det här dokumentet beskriver bara skillnaderna.

## 1. Mål

Ett samlat flöde när en medarbetare slutar: HR/chef triggar, ansvariga får uppgifter automatiskt, system-konton stängs, hårdvara/licenser återlämnas, sista lön och slutsamtal hanteras — utan att någon glöms bort.

## 2. Trigger

Två vägar in (parallellt med onboarding):

1. **Manuell start** (primär i fas 1) — HR eller chef öppnar `/offboarding/new`, väljer person, slutdatum, orsak (egen uppsägning / arbetsgivarens / pension / annat), och om utträdet är *normalt* eller *snabbavslut* (samma dag).
2. **Heartpace-signal** (förberedd i fas 1, aktiveras i fas 2) — när `heartpace-sync-personnel` ser ett nytt `slutdatum` på en profil skapas ett utkast-instans automatiskt och HR får notis "Bekräfta offboarding för X".

Trigger-källan loggas i `offboarding_instances.trigger_source` (`'manual' | 'heartpace'`).

## 3. Datamodell

Återanvänder onboarding-mönstret rakt av. Tre tabeller:

```sql
-- Mall (en rad per återkommande offboarding-uppgift)
offboarding_template_tasks (
  id, sort_order, title, description,
  assignee_source text,        -- 'static_profile' | 'tool_owner' | 'nearest_manager' | 'role' | 'hr'
  assignee_profile_id uuid,
  assignee_tool_id uuid,
  assignee_role text,
  due_offset_days int,         -- relativt slutdatum (negativt = före, positivt = efter)
  category text,               -- 'system' | 'hardware' | 'access' | 'hr' | 'finance' | 'social'
  conditional text,            -- 'always' | 'if_company_car' | 'if_keys' | 'if_phone' osv.
  is_active boolean
);

-- Instans per medarbetare som slutar
offboarding_instances (
  id, profile_id uuid,           -- den som slutar
  initiated_by uuid,             -- HR/chef
  trigger_source text,           -- 'manual' | 'heartpace'
  last_day date not null,
  reason text,                   -- 'voluntary' | 'employer' | 'retirement' | 'other'
  exit_type text,                -- 'normal' | 'immediate'
  notes text,
  status text,                   -- 'draft' | 'active' | 'completed' | 'cancelled'
  cancelled_reason text,
  created_at, updated_at
);

-- Uppgifter (snapshot av mall vid skapande)
offboarding_tasks (
  id, instance_id uuid,
  template_task_id uuid,         -- för spårbarhet
  title, description, category,
  assignee_profile_id uuid,      -- resolvad ägare
  due_date date,
  status text,                   -- 'pending' | 'done' | 'not_applicable'
  done_at, done_by,
  auto_resolved boolean,         -- t.ex. "ingen tjänstebil" → markerad N/A direkt
  notes text,
  created_at, updated_at
);
```

Identiska grants/RLS-mönster som onboarding-tabellerna.

## 4. Mall — utgångsläge

Kategoriserat efter ansvarig. Allt med `tool_owner` resolvas dynamiskt vid skapande.

### System & licenser (`tool_owner`)
- Avsluta konto i: Google Workspace (IT), Heartpace (HR), Rillion, Vitec/3L, Rekyl, IT-hotellet, Creditsafe, Momentum, Webport, Bereko, iBinder, Metry, Vyer, Zendesk, Uniguide, Spiris, Collectum, Bank
- Återkalla shared-password access (Passwords-modulen)
- Ta bort från relevanta grupper (`group_members`)
- Arkivera mejl + Drive (IT, efter `last_day + 30 dagar`)

### Hårdvara & passage (`role: it` eller `static: Christel`)
- Återta dator, telefon, headset, nycklar/passerkort, kreditkort
- Markera utrustning som "återlämnad" i framtida `equipment`-modul

### HR & ekonomi (`role: hr`)
- Sluttidsrapport / semestersaldo
- Sista lön + semesterersättning
- Avregistrera försäkringar, Collectum, friskvård
- Uppdatera anställningsförteckning
- Skicka tjänstgöringsbetyg (om begärt)

### Chef (`nearest_manager`)
- Slutsamtal / exit-intervju
- Avtacka i teamet (mejl/lunch/blomma)
- Fördela pågående ärenden
- Uppdatera org-chart

### Konditionella (visas bara om relevant)
- Tjänstebil → återlämning + drivmedelskort (`if_company_car`)
- Hemmakontor-utrustning (`if_remote_equipment`)
- Externa systembehörigheter hos kund (`if_external_access`)

HR kan markera ej-tillämpliga punkter som `not_applicable` direkt vid start.

## 5. Återlämning — egen checklista, inte order

Till skillnad från onboarding (där hårdvara/licens hanteras via `/orders/new`) hanteras återlämning **direkt i offboarding-instansen**:

- Varje hårdvaru-/system-uppgift har kryssruta + fritextfält ("status", "skick", "lämnad till X")
- Ingen `orders`-rad skapas, ingen godkännandekedja
- Motivering: återlämning saknar pris/leverans/godkännande-aspekt och passar bättre som en uppgift än som en order

Om vi i framtiden inför en `equipment`-modul (tilldelad utrustning per profil) ska de raderna istället uppdateras till `status = 'returned'` av samma uppgift.

## 6. Tidslinje

`due_offset_days` räknas från `last_day`:

| Offset | Exempel |
|---|---|
| -14 | Slutsamtal bokas, avtacknings-planering |
| -7 | Bekräfta återlämningslista med medarbetaren |
| -3 | Påminnelse till alla system-ägare |
| 0 (sista dagen) | Återlämna hårdvara, nycklar, kort. Inaktivera Google-konto kl 17:00 |
| +1 | Avsluta licenser i alla system |
| +7 | Sista lön körd |
| +30 | Arkivera mejl/Drive, ta bort från grupper |
| +90 | Slutrensning (radera arkiv om inget juridiskt skäl finns) |

## 7. Mejl & notiser

Återanvänd onboarding-pipen:
- Batch-mejl per ansvarig (en mejl med alla deras uppgifter för instansen)
- Daglig påminnelse-cron för försenade uppgifter
- HR får sammanfattning när alla uppgifter är klara → status `completed`

Nya mall-mejl (React Email, registry):
- `offboarding-owner-task-batch` — speglar onboarding-varianten
- `offboarding-reminder` — speglar onboarding-varianten
- `offboarding-completed` — till HR + chef
- `offboarding-cancelled` — om HR avbryter (medarbetaren stannar)

## 8. UI

- `/offboarding` — HR-lista (aktiva, kommande, avslutade)
- `/offboarding/new` — formulär (person, slutdatum, orsak, exit_type, notes)
- `/offboarding/:id` — instansvy med uppgifter grupperade per kategori + ansvarig, kryssrutor + fritext
- `/admin → Offboarding-mall` — CRUD för mall-rader (samma komponent som onboarding-mallen, generisk)

Sidofält: under "HR" tillsammans med onboarding. Endast HR-grupp + admin ser sektionen.

## 9. Säkerhet / RLS

- `offboarding_instances` & `offboarding_tasks`: SELECT/INSERT/UPDATE för HR-grupp + admin, samt `assignee_profile_id = auth.uid()` får uppdatera *sina egna* uppgifter
- Den som slutar ser **inte** sin egen instans (känsligt — slutsamtal, orsak)
- Chef ser endast instansens översikt för sin direktrapport (via `is_subordinate_order`-mönstret, omdöpt till hjälpfunktion)

## 10. Edge cases

1. **Snabbavslut samma dag** (`exit_type='immediate'`) — alla system-uppgifter får `due_date = today`, Google-konto inaktiveras omedelbart, chef notifieras direkt.
2. **Pensionering** — arkivering hålls längre (5 år), avtackning prioriteras.
3. **Återanställning innan slutdatum** — HR sätter `status='cancelled'`, `cancelled_reason`, alla öppna uppgifter stängs.
4. **Förlängt slutdatum** — `last_day` uppdateras → alla `due_date` räknas om för uppgifter som inte är klara.
5. **Tvist / juridik** — flagga på instansen som stoppar arkivering tills HR släpper den.
6. **Personen har pågående orders i `/orders`** — visas i instansvyn ("Pågående beställningar att hantera"); chef beslutar om de fullföljs eller annulleras.
7. **Personen är chef för andra** — `manager_id`-pekare för subordinates måste flyttas; uppgift till HR + ny chef.

## 11. Genomförande — agenter

Bygg efter att onboarding-fas-1 (Agent A–F i `docs/onboarding-plan.md`) är levererad, så vi får återanvända samma komponenter och mejl-pipe.

```text
A-off (schema: 3 nya tabeller + grants + RLS)
   │
   ├─► B-off (edge functions: skapa instans, resolva ägare, batch-mejl, cron-påminnelse)
   ├─► C-off (mejl-mallar: 4 nya React Email-templates + registry)
   ├─► D-off (admin-UI: mall-editor — generisk komponent delad med onboarding)
   ├─► E-off (HR-UI: /offboarding, /offboarding/new, /offboarding/:id)
   └─► F-off (Heartpace-trigger: utvidga heartpace-sync-personnel med slutdatum-detektion → utkast-instans)
```

A-off blockar resten (regenererad `types.ts`). C-off och D-off kan köras parallellt med B-off.

## 12. Öppna frågor

1. Ska den som slutar få ett eget mejl med "checklista för dig" (lämna in saker, byt privat mejl i Heartpace, etc.)?
2. Hur länge ska arkiverade Google-konton sparas innan slutradering? Förslag: 90 dagar standard, 5 år vid pensionering, juridisk-flagga blockerar.
3. Ska slutsamtals-anteckningar lagras i instansen (känsligt) eller bara markeras "genomfört"?
4. Ska vi automatiskt skapa en planner-kort i HR-boarden per offboarding för översikt?
5. Behövs en "återrapportering" till chefen efter 30 dagar (allt klart, inget hänger)?
