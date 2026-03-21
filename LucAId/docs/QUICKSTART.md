# LucAId — Quickstart

Denna guide tar dig från noll till ett fungerande LucAId-paket på ungefär 30–60 minuter, beroende på hur stort ditt projekt är.

Du behöver inte förstå hela systemet för att komma igång. Följ stegen i ordning.

---

## Vad är LucAId och varför behövs det?

När du ber en AI (Claude, Cursor, Copilot) analysera din kod vet den ingenting om ditt system. Den ser filer, men inte:
- Vad systemet är *tänkt* att göra
- Vilka regler som gäller för olika delar
- Vilka risker som redan är kända
- Vem som får göra vad

Det betyder att AI:n gissar — och gissar fel.

**LucAId är ett paket med strukturerade dokument** som du lägger i ditt repo. När AI:n läser dem vet den hur ditt system fungerar, vilka regler som gäller, och vilka risker som finns. Analysen blir konkret istället för generisk.

Som bonus validerar LucAId sig självt i CI och berättar på varje PR vilka dokument som är relevanta för de ändringar som gjorts.

---

## Vad du behöver

- Ett repo med kod (fungerar med vilket språk/stack som helst)
- Tillgång till en AI-assistent (Claude, ChatGPT, Cursor, eller liknande)
- Python 3.8+ installerat lokalt (för att köra validatorn)
- GitHub Actions om du vill ha CI-integration (valfritt men rekommenderat)

---

## Steg 1 — Lägg LucAId i ditt repo

Kopiera innehållet i detta paket till en mapp som heter `lucaid/` i roten av ditt repo:

```
ditt-repo/
├── src/
├── lucaid/          ← lägg allt här
│   ├── manifest.json
│   ├── schema.json
│   ├── VERSION
│   ├── docs/
│   ├── tools/
│   └── ...
└── ...
```

---

## Steg 2 — Generera SYSTEM_OVERVIEW.md

Det här är det viktigaste steget. `SYSTEM_OVERVIEW.md` är basen som alla andra dokument bygger på.

**Öppna din AI-assistent och ge den hela kodbasen** (eller de viktigaste filerna), sedan klistra in denna prompt:

```
Analysera detta repository och producera en SYSTEM_OVERVIEW.md med följande avsnitt:

1. Systembeskrivning — vad gör systemet, vem använder det, vad löser det?
2. Användarroller — lista alla roller med beskrivning och behörigheter
3. Moduler/funktionsområden — lista alla delar med routes, åtkomstkontroll och DB-tabeller
4. Databasstruktur — alla tabeller med nyckelkolumner och relationer
5. Backend-funktioner/tjänster — alla API-endpoints, edge functions eller services
6. Integrationer — externa system och API:er
7. Kända komplexitetsområden — delar av koden som kräver extra uppmärksamhet
8. Vad systemet INTE är — explicita scope-gränser

Var konkret. Använd faktiska namn från koden (tabellnamn, filnamn, funktionsnamn).
Skriv på engelska.
```

Spara svaret i `lucaid/docs/SYSTEM_OVERVIEW.md` och ersätt skelettinnehållet.

> 💡 **Tips:** Om din kodbas är stor, ge AI:n de viktigaste filerna: routing-filen, databasmigrationer, auth-relaterade filer och en översiktlig README om den finns.

---

## Steg 3 — Fyll i resterande dokument med AI-hjälp

Nu när du har `SYSTEM_OVERVIEW.md` kan AI:n fylla i resten. Ge den `SYSTEM_OVERVIEW.md` + skelettfilen och klistra in denna prompt för varje dokument:

---

**För `docs/core/DOMAIN_RULES.md`:**
```
Baserat på SYSTEM_OVERVIEW.md och kodbasen, fyll i DOMAIN_RULES.md.
Dokumentet ska beskriva de affärsregler som gäller per modul — vad systemet
är tänkt att göra, inte hur det är implementerat.
Inkludera livscykler och tillstånd för alla entiteter som har status-fält.
Skriv på engelska.
```

**För `docs/core/ARCHITECTURE.md`:**
```
Baserat på SYSTEM_OVERVIEW.md, fyll i ARCHITECTURE.md.
Fokusera på: systemlager, förtroensgränser (vad är trusted/untrusted),
vem som äger enforcement av olika regler (client/API/DB), och blast radius
för de känsligaste komponenterna.
Skriv på engelska.
```

**För `docs/core/PERMISSION_MODEL.md`:**
```
Baserat på SYSTEM_OVERVIEW.md och kodbasen, fyll i PERMISSION_MODEL.md.
Dokumentera: alla roller, alla behörighetskällor, hur konflikter löses,
och vilka kontroller som är client-only vs backend-enforced.
Skriv på engelska.
```

**För `docs/core/WORKFLOW_MAPS.md`:**
```
Baserat på SYSTEM_OVERVIEW.md och DOMAIN_RULES.md, fyll i WORKFLOW_MAPS.md.
Dokumentera de 5–15 viktigaste flödena som steg-för-steg-kartor.
Inkludera: trigger, aktör, varje steg med enforcement och felpunkter,
samt 2–3 smoke tests per workflow.
Skriv på engelska.
```

**För `docs/reference/DATA_MODEL.md`:**
```
Baserat på SYSTEM_OVERVIEW.md och databasmigrationer (om tillgängliga),
fyll i DATA_MODEL.md.
Inkludera: alla tabeller med kolumner, typer, nullable-status, FK-relationer,
enum-typer med tillåtna värden, och kända constraints eller säkerhetsrisker.
Skriv på engelska.
```

**För `docs/reference/CODEBASE_GLOSSARY.md`:**
```
Baserat på SYSTEM_OVERVIEW.md, fyll i CODEBASE_GLOSSARY.md.
Lista alla systemspecifika termer: roller, domänbegrepp, tabellnamn,
funktionsnamn, och statusvärden — med kanoniska definitioner.
Skriv på engelska.
```

**För `docs/governance/KNOWN_RISKS.md`:**
```
Baserat på SYSTEM_OVERVIEW.md, ARCHITECTURE.md och PERMISSION_MODEL.md,
identifiera de 5–10 mest kritiska riskerna i systemet.
Använd RISK-format med Severity (Critical/High/Medium/Low), Status, Area,
Description, Impact, och Mitigation.
Skriv på engelska.
```

---

> 💡 **Du behöver inte fylla i allt på en gång.** Börja med `SYSTEM_OVERVIEW.md`, `DOMAIN_RULES.md` och `KNOWN_RISKS.md` — det ger omedelbart värde. Fyll i resten iterativt.

---

## Steg 4 — Auto-generera impact_map (valfritt men rekommenderat)

Istället för att skriva `impact_map`-patterns för hand kan du låta LucAId analysera ditt repo och föreslå dem:

```bash
cd ditt-repo/
python lucaid/tools/lucaid_discover.py --root . --output lucaid-discovery.json
```

Outputen är ett JSON-dokument med föreslagna `impact_map`-entries. Kopiera dem till `manifest.json` och justera patterns efter behov.

> 💡 Nytt i v3.6 — ersätter manuellt skrivna regex-patterns som startpunkt.

---

## Steg 5 — Konfigurera manifest.json

Öppna `lucaid/manifest.json` och ersätt platshållarna:

```json
"package": {
  "name": "LucAId",
  "version": "3.5.0",
  "repository": "din-org/ditt-repo",     ← ändra detta
  "system": "Ditt Systemnamn",            ← ändra detta
  "generated_at": "2026-03-21",          ← ändra detta
  ...
}
```

Konfigurera sedan `impact_map` — detta berättar för LucAId vilka delar av koden som påverkar vilka dokument. Se `examples/shf-intra/manifest.json.example` för ett komplett exempel.

**Minsta möjliga impact_map** (byt ut sökvägarna mot dina):

```json
"impact_map": [
  {
    "id": "auth_permissions",
    "patterns": ["^src/auth/", "^src/middleware/"],
    "review_docs": [
      "docs/core/PERMISSION_MODEL.md",
      "docs/governance/KNOWN_RISKS.md",
      "docs/governance/CHANGE_SAFETY_RULES.md"
    ],
    "notes": ["Verifiera server-side enforcement."]
  },
  {
    "id": "backend",
    "patterns": ["^api/", "^supabase/functions/", "^migrations/"],
    "review_docs": [
      "docs/core/ARCHITECTURE.md",
      "docs/reference/DATA_MODEL.md",
      "docs/governance/KNOWN_RISKS.md",
      "docs/governance/CHANGE_SAFETY_RULES.md"
    ],
    "notes": ["Kontrollera om ändringen påverkar kända risker."]
  }
]
```

> 💡 **Tips:** Patterns är regex. `^src/auth/` matchar alla filer under `src/auth/`. Börja enkelt och lägg till fler areas iterativt.

---

## Steg 6 — Validera paketet

```bash
cd lucaid/
pip install jsonschema
python tools/lucaid_validate.py
```

Ett rent resultat ser ut så här:

```json
{
  "ok": true,
  "package_version": "3.5.0",
  "registered_docs": 20,
  "verified_context_docs": 13,
  "validation_layers": 8,
  "results": []
}
```

Om du får ERRORs finns det ett `suggested_fix` per finding som säger exakt vad som behöver åtgärdas.

---

## Steg 7 — Använd LucAId för AI-analys

Nu är du redo. Så här använder du paketet:

### Full kodbasanalys

1. Öppna din AI-assistent (Claude, Cursor, etc.)
2. Ladda in alla filer i `docs/` i den ordning som anges i `docs/MASTER_PROMPT.md`
3. Klistra in innehållet i `docs/MASTER_PROMPT.md` som system-prompt
4. Be AI:n analysera kodbasen

### PR-granskning

1. Kolla vilket impact_map-utfall CI genererade för PR:en (GitHub Step Summary eller PR-kommentaren)
2. Ladda bara de dokument som CI flaggade som relevanta
3. Använd `docs/AUTO_AUDIT_PROMPT.md` som prompt
4. Be AI:n granska ändringarna

---

## Steg 8 (valfritt) — Lägg till CI

Kopiera `.github/workflows/lucaid-audit.yml` till ditt repos `.github/workflows/`-mapp.

På varje PR kommer CI nu att:
- Validera att LucAId-paketet är konsistent
- Beräkna vilka dokument som är relevanta för ändringarna
- Posta en sammanfattning som PR-kommentar

**Förutsättning:** Uppdatera sökvägar i workflow-filen om du lade LucAId i en undermapp (t.ex. `lucaid/`) istället för i roten.

---

## Vanliga frågor

**Måste jag fylla i alla dokument?**
Nej. Börja med `SYSTEM_OVERVIEW.md` och `KNOWN_RISKS.md`. Lägg till resten när du har tid. Validatorn varnar om filer saknas men stoppar inte dig.

**Fungerar det med annat än GitHub?**
Verktygen (`lucaid_validate.py`, `lucaid_plan.py`) fungerar var som helst med Python. CI-workflowen är GitHub Actions-specifik, men konceptet går att porta till GitLab CI eller liknande.

**Hur håller jag dokumenten uppdaterade?**
Validatorn i CI flaggar när dokument inte matchar varandra. När systemet ändras: uppdatera `SYSTEM_OVERVIEW.md` först, sedan berörda core-docs. Kör validatorn för att verifiera.

**Kan jag använda LucAId utan att förstå alla delar?**
Ja. Minsta fungerande setup: `SYSTEM_OVERVIEW.md` ifylld + `manifest.json` konfigurerad + validatorn kör rent. Resten är optionellt men ger mer värde.

**Var hittar jag ett komplett exempel?**
Se `examples/shf-intra/` — ett fullt ifyllt LucAId-paket för ett React + Supabase-projekt.

---

## Nästa steg

När du är igång, läs `docs/README.md` för teknisk dokumentation om alla delar av systemet.
