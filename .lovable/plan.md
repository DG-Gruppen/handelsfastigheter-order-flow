

## Förbättra profilkläder admin-panel

### Problem
Panelen har bra grundfunktionalitet men saknar:
1. **Sammanställning** visar inte VEM som beställt varje plagg
2. **Plocklista** kan bara laddas ner som en enda CSV -- behöver kunna laddas ner/skrivas ut per region

### Ändringar

**Fil: `src/components/workwear/WorkwearAdminPanel.tsx`**

#### 1. Utöka Sammanställning-fliken
- Lägg till en kolumn "Beställare" som visar namnen på de som beställt varje plagg/färg/storlek-kombination (kommaseparerade)
- Lägg till en kolumn "Region" som visar vilka regioner beställningarna kommer från
- Uppdatera `itemStats` att spåra beställarnamn och regioner per artikel
- Uppdatera CSV-exporten med de nya kolumnerna

#### 2. Plocklista per region
- Byt ut den enskilda CSV-knappen mot en dropdown med:
  - "Ladda ner alla" (som idag)
  - En knapp per region (Norr, Söder, Mitt/Bromma) som filtrerar plocklistan till enbart den regionen
- Lägg till en "Skriv ut"-knapp som öppnar webbläsarens utskriftsdialog med utskriftsvänlig formatering (via `@media print` eller `window.print()` på en filtrerad vy)
- Regionrubrik som gruppöverskrift i tabellen för tydligare visuell separation

#### 3. Beställningar-fliken
- Lägg till en expanderbar rad (eller tooltip) som visar detaljerade plagg per beställning (produktnamn, färg, storlek, antal) -- just nu visas bara sammanfattade plaggnamn

### Inga databasändringar
All data finns redan i `workwear_orders.items` (JSONB) och `profiles.region_id` → `regions`.

### Tekniska detaljer
- Utöka `itemStats` map value med `orderers: Set<string>` och `regions: Set<string>`
- Plocklista per-region-download: filtrera `pickRows` på `row.region === regionName` innan CSV-generering
- Print: skapa en dold `<div>` med print-styles eller använd `window.print()` med CSS `@media print`

