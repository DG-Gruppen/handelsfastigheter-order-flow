

## Plan: Uppdatera Cision-feedkällor

### Sammanfattning
Byt ut de befintliga Cision-URL:erna i edge-funktionen mot de två nya fungerande endpointsen. Eftersom båda returnerar samma innehåll behåller vi samma primär/fallback-strategi men med de nya URL:erna.

### Ändringar

**1. Uppdatera `supabase/functions/fetch-cision-feed/index.ts`**
- Byt `CISION_FEED_URL` till `https://publish.ne.cision.com/Release/ListReleasesSortedByPublishDate/?feedUniqueIdentifier=2108847f44`
- Byt `CISION_RSS_URL` till `https://news.cision.com/se/svenska-handelsfastigheter/ListItems?format=rss`
- Den första URL:en returnerar XML/HTML, inte JSON — anpassa parsningen till XML-format istället för JSON
- Behåll RSS-fallback med samma befintliga RSS-parser

### Teknisk detalj
URL 1 returnerar XML (inte JSON som den gamla papi-endpointen). Parsern behöver uppdateras för att extrahera `<Title>`, `<PublishDate>`, bilder etc. från XML-formatet med CDATA-block. Alternativt kan vi göra RSS-feeden (URL 2) till primärkälla istället, eftersom RSS-parsern redan finns och fungerar.

**Rekommendation**: Gör RSS-feeden (URL 2) till primärkälla — den fungerar bevisligen och parsern finns redan. Behåll URL 1 som fallback med en enkel XML-parser.

