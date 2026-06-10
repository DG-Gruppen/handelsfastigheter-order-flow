## Vad jag gör

1. **Spara planen** som `docs/onboarding-plan.md` (versionerad, redigerbar tillsammans).
2. **Skriv om mallen så ansvariga hämtas dynamiskt från `tools`-modulen** istället för hårdkodade namn — Petras dokument listar i princip "vem äger systemet X" för varje behörighetsrad, vilket är exakt det `tool_owners` redan svarar på.

## Innehåll i `docs/onboarding-plan.md`

Hela planen från tidigare (Petras flöde, gap-analys, datamodell, etappindelning, öppna frågor) plus ett nytt avsnitt:

### Dynamisk koppling till verktyg

Mall-uppgifter får en ny fälttyp `assignee_source`:

| `assignee_source` | Betydelse | Exempel från Petras dokument |
|---|---|---|
| `static_profile` | Fast person (`profile_id`) | "Petra/HR registrerar avtal" |
| `tool_owner` | Slå upp ägare till verktyg `tool_id` vid skapande | "Behörighet i Creditsafe" → ägaren till Creditsafe i `tools` |
| `nearest_manager` | Nyanställdas chef från Heartpace | "Boka lunch första dagen" |
| `role` | Härled från grupp (HR-grupp, IT-grupp) | "Lägg upp i Heartpace" → HR-gruppen |

**Vinster:**
- När en systemägare byts i `/admin → Verktyg` uppdateras vem som får onboarding-mejlet automatiskt — ingen mall behöver röras.
- Flera ägare per verktyg (vi har redan `tool_owners` many-to-many) → flera mottagare för samma uppgift utan dubbletter.
- Mallen blir mycket kortare: istället för "Emma Lundberg → Rillion, Vitec/3L, Rekyl, IT-hotellet" får vi en rad per verktyg som pekar på `tool_id`, och systemet grupperar mejlen per ansvarig vid utskick.

**Placeholders i mejltexten** utökas:
- `[verktyg]` — verktygets namn (för uppgifter med `tool_owner`)
- `[ansvarig]` — mottagarens förnamn
- befintliga: `[namn]`, `[startdatum]`, `[befattning]`, `[chef]`

### Mall-rader som flyttar från statiska till `tool_owner`

Direkt mappning mot befintliga verktyg på `/verktyg`:
- Rillion, Vitec/3L, Rekyl, IT-hotellet, Bank → respektive verktygs ägare (idag Emma)
- Creditsafe → ägare (Marit)
- Momentum → ägare (Wilma)
- Webport, Bereko, iBinder, Metry → ägare (Jörgen)
- Vyer → ägare (Pernilla)
- Zendesk → ägare (Erika)
- Uniguide → ägare (Christel)
- Spiris (tid/utlägg), Collectum → ägare (Fastighetssnabben/Agnes)

### Mall-rader som förblir statiska (eller `role`)
- Allt HR-arbete (avtal, försäkringar, anställningsförteckning) → `role: HR`
- "Närmaste chef"-uppgifter (välkomstmejl, lunch, blomma, introduktion) → `nearest_manager`
- Christels icke-systemuppgifter (nycklar, What's Up Kris) → `static_profile`
- Webbsida (Inga Påhlsson) → `static_profile` (inget verktyg "SHF webb" finns ännu — kan läggas till senare)

### Konsekvens för datamodellen

`onboarding_template_tasks` får:
```
assignee_source  text   -- 'static_profile' | 'tool_owner' | 'nearest_manager' | 'role'
assignee_profile_id  uuid null  -- för static_profile
assignee_tool_id     uuid null  -- för tool_owner
assignee_role        text null  -- för role (t.ex. 'hr')
```

Vid skapande av en `onboarding_instance` resolvas detta en gång till konkreta `assignee_profile_id` på varje `onboarding_tasks`-rad (snapshot), så att senare ägarbyten inte påverkar pågående onboardings.

## Frågor som fortfarande behöver svar (samma som tidigare planen)

1. Ett samlat mejl per ansvarig — bekräfta.
2. Heartpace-trigger via befintlig sync eller webhook.
3. "Om aktuellt"-punkter: kryssas av HR vid start eller markeras "ej aktuellt" av ansvarig?
4. In-app-notiser utöver mejl?
5. Ska vi lägga in "SHF webbsida" som ett verktyg så även Ingas uppgift kan bli `tool_owner`?

## Leverans nu

I build mode skapar jag bara filen `docs/onboarding-plan.md` med ovanstående innehåll. Inga kodändringar än — vi itererar på dokumentet först.
