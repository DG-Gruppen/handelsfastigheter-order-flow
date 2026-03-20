

## Plan: Kommentarer på jubilarkort

### Koncept
Varje jubilarkort (födelsedag/jubileum) får en liten kommentarssektion. Kommentarerna knyts till en **veckonyckel** (t.ex. `birthday:Anna Svensson:2026-W12`) som gör att de automatiskt "försvinner" nästa gång kortet visas (nästa år) — ingen cleanup behövs, vi filtrerar bara på aktuell veckonyckel.

### UX-flöde
- Varje kort visar en liten pratbubbla-ikon med antal kommentarer
- Klick öppnar en inline-sektion (under kortet) med befintliga kommentarer + ett litet textfält
- Kommentarer visas med avsändarens namn och tid
- Mobilanpassat: full bredd, touch-vänliga targets (h-12 input)

### Tekniska steg

**1. Ny databastabell `celebration_comments`**
```sql
CREATE TABLE public.celebration_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key text NOT NULL,        -- t.ex. "birthday:Anna Svensson:2026-W12"
  user_id uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.celebration_comments ENABLE ROW LEVEL SECURITY;
-- Alla inloggade kan läsa och skriva
CREATE POLICY "Authenticated can view" ON public.celebration_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own" ON public.celebration_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own" ON public.celebration_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

**2. Uppdatera `Celebration`-interfacet**
- Lägg till `weekKey: string` (genereras som `${type}:${name}:${isoWeek}`)

**3. Ny komponent `CelebrationComments`**
- Props: `weekKey`, `compact` (dold i dashboard-versionen)
- Hämtar kommentarer filtrerat på `week_key`
- Visar kommentarer + input-fält
- Hämtar avsändarnamn via profiles-join eller separat query
- Expanderar/kollapsar med en pratbubbla-knapp

**4. Uppdatera `WeeklyCelebrations`**
- Integrera `CelebrationComments` i varje kort (bara i full-versionen på Kultursidan, ej compact/dashboard)
- Kortet expanderas vertikalt när kommentarer öppnas

### Mobilanpassning
- Input-fältet använder minst h-12 för touch
- Kommentarslistan scrollar vid >3 kommentarer (max-h med overflow)
- Full bredd på mobil (redan hanterat av grid sm:grid-cols-2 → 1 kolumn på mobil)

