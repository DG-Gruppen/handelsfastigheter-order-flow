

## Plan: Lägg till birthday-fält och visa på personalkort

### 1. Databasmigration — lägg till `birthday`-kolumn på `profiles`

```sql
ALTER TABLE public.profiles ADD COLUMN birthday date DEFAULT NULL;
```

### 2. Importera födelsedagar från Excel-filen

Kör ett script som läser Excel-filen och matchar namn mot profiler, sedan uppdaterar `birthday` via SQL INSERT/UPDATE.

Matchning sker på `full_name`. De 54 personerna i filen matchar alla befintliga profiler (bekräftat i föregående analys).

### 3. Uppdatera Personnel-sidan

**`src/pages/Personnel.tsx`**:
- Lägg till `birthday` i `PersonnelProfile`-interfacet och i select-queryn
- Importera `Cake`-ikonen från lucide-react
- Visa födelsedatum på varje personalkort (formaterat som "12 mars") under avdelningsraden
- Lägg till en liten tårtikon bredvid datumet

### Filer som ändras
| Fil | Ändring |
|-----|---------|
| Migration (SQL) | `ALTER TABLE profiles ADD COLUMN birthday date` |
| Script (engångs) | Importera 54 födelsedagar från Excel → profiles |
| `src/pages/Personnel.tsx` | Visa födelsedag på korten |

