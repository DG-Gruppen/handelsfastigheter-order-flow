

## Profilkläder Admin – Beställningslista & Plocklista

### Sammanfattning
Uppgradera admin-panelen med Excel-liknande sortering på alla tabeller, en ny "Beställningslista" (underlag till leverantör) och en ny "Plocklista" (för utleverans per region/person). Båda ska kunna exporteras.

### Vad som byggs

**1. Klickbar sortering på alla kolumner (alla flikar)**
Varje kolumnrubrik blir klickbar med sorteringspil (▲/▼). Klick växlar asc → desc → ingen sortering. Gäller alla fem flikar (befintliga + nya).

**2. Ny flik: "Beställningslista" (leverantörsunderlag)**
Tabell med kolumnerna:
- Plagg | Färg | Storlek | Antal | Logga (brodyr/tryck, svart/vit)

Logga-info extraheras ur befintlig `colorLabel` (texten inom parentes, t.ex. "tryck svart", "brodyr vit").

Subtotalrader per plagg (totalt antal oavsett färg/storlek). Möjlighet att sortera på valfri kolumn, inklusive logga-kolumnen (så man kan gruppera alla "brodyr svart" etc).

**3. Ny flik: "Plocklista" (leveransunderlag)**
Tabell med kolumnerna:
- Kontor (region) | Namn | Plagg | Färg | Storlek | Antal

En rad per unik kombination (anställd + plagg + storlek). Sorterbar på alla kolumner. Regionfiltret som redan finns gäller även här.

**4. Export-knappar**
Varje flik får en "Exportera CSV"-knapp som laddar ner den aktuella (filtrerade + sorterade) vyn som CSV-fil. Detta ger ett underlag man kan skicka till leverantören eller skriva ut som plocklista.

### Tekniska detaljer

**Fil som ändras:** `src/components/workwear/WorkwearAdminPanel.tsx`

- Ny `SortableHeader`-hjälpkomponent (inline) som renderar `<TableHead>` med klick-handler och sorteringspil.
- Sorteringsstate per flik: `{ key: string, dir: 'asc' | 'desc' } | null`.
- `parseLogoInfo(colorLabel)` – extraherar text inom parentes ur colorLabel.
- Beställningslistan: Utökar befintlig `itemStats` med `logo`-fält.
- Plocklistan: Ny `useMemo` som plattar ut orders till rader per person+plagg+storlek.
- CSV-export: En `downloadCsv(rows, headers, filename)` hjälpfunktion som genererar och laddar ner CSV.

Inga databasändringar behövs – all data finns redan i `workwear_orders.items`.

