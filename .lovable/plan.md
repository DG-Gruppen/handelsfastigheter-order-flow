

## Importera regionstilldelningar från Word-fil

### Sammanfattning
Kör ett SQL-skript som matchar de 57 namnen från Word-filen mot `profiles.full_name` och sätter `region_id` baserat på korrekt regiontillhörighet.

### Regionfördelning (korrigerad för sidbrytning)

**Region Syd (18 st):** Beatrice Hedblom, Benny Andersson, Carl-Johan Örnberg, Daniel Olsson, Dick Magnusson, Fredrik Johansson, Jesper Rubin, Jörgen Seegh, Julia Eckerholm, Julia Parker, Kenneth Sjöstrom, Liridon Rama, Louise Grönvall, Marika Sprinzl, Marika Palm, Pernilla Kjellén, Peter Högberg, Ramona Halvars

**Region Mitt/Bromma (30 st):** Amanda Orre, Bircan Djafer, Camilla Clemens, Carolina Enhörning, Christel Johansson Korsner, Christian Olave, Claes Setthagen, Emma Lundberg, Erika Venäläinen, Fredrik Klasson, Fredrik Nordén, Inga Påhlsson, Jan Andersson, Jöran Rydberg, Jörgen Larssen, Josefine Johannsessen, Louise Eldwinger, Malin Ekwall, Malin Norén, Marit Karlsson, Mathias Jung, Mats Jäverlind, Mimmi Gade, Niklas Bodell, Petra Bondesson, Sara Ekesiöö, Thomas Holm, Thomas Österbladh, Tommi Pakola, Wilma Norin

**Region Nord (9 st):** Albin Östman, Alice Streymoy, Anders Norin, Erik Källberg, Gustaf Drake, Johan Eklund, Knud Lauridsen, Mats Bjuhr, Patrick Kaemmerle

### Teknisk approach

1. Hämta region-ID:n från `regions`-tabellen (Norr, Söder, Mitt/Bromma)
2. Kör UPDATE-satser via insert-verktyget (data-operation, ingen migration)
3. Matcha på `full_name` (utan parenteser som "Kalmar", "Örnsköldsvik")
4. Logga eventuella namn som inte hittas i systemet

### Undantag
DG-gruppen och Toni Kazarian ingår inte och får ingen region tilldelad.

