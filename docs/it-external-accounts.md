# Hantering av IT/Support- och externa konton i SHF Intra

## Syfte
Denna dokumentation beskriver hur systemet visuellt hanterar två särskilda kategorier av användarkonton:
- **IT/Support-konton** – interna tekniska/systemkonton
- **Externa konton (`is_external`)** – konton för personer utanför organisationen

Dessa konton döljs i de flesta publika listvyer och sökresultat för att hålla personalöversikten ren och relevant för slutanvändarna.

---

## 1. Vilka konton avses?

### IT/Support-konton (flaggade med `heartpace_sync_excluded = true`)
Konton som tillhör IT/Support-avdelningen och används för systemadministration eller teknisk support:

| Namn | Avdelning | Motivering |
|------|-----------|------------|
| Anders Larsson | IT/Support | Intern teknisk personal |
| Toni Kazarian | IT/Support | Intern teknisk personal |
| DG Gruppen Support | IT/Support | System-/supportkonto |

**Egenskaper:**
- Tilldelad avdelning: **IT/Support** (`department_id = 891dc877-6358-4a78-86c9-36c3b46182c3`)
- `heartpace_sync_excluded = true` – synkas aldrig från Heartpace HR-system
- `is_external = false` – är fortfarande interna konton i databasen

### Externa konton (`is_external = true`)
Konton skapade för personer utanför Handelsfastigheter, t.ex. konsulter, samarbetspartners eller gästanvändare.

**Egenskaper:**
- `is_external = true` – markerat vid skapande eller migrering
- `heartpace_sync_excluded = true` – synkas aldrig från Heartpace
- Dessa konton har begränsad åtkomst till moduler och visas inte i personalöversikter

---

## 2. Var döljs dessa konton?

### 2.1 Personal (`/personal`)
**Fil:** `src/pages/Personnel.tsx`

Både IT/Support-konton och externa konton filtreras bort innan rendering:

```typescript
const profiles = (profilesRes.data ?? []).filter(
  (p) =>
    !itUserIds.has(p.user_id) &&      // Dölj IT/Support-konton
    p.full_name.trim() !== "" &&
    p.is_external !== true &&           // Dölj externa konton
    p.heartpace_sync_excluded !== true  // Dölj exkluderade konton
);
```

**Resultat:** Dessa konton syns inte i personalregistret, sökresultat eller födelsedagslistan.

---

### 2.2 Org-karta (`/org`)
**Fil:** `src/pages/OrgTree.tsx`

Samma filtrering appliceras på organisationsdiagrammet:

```typescript
const profiles = (profilesData ?? []).filter(
  (p) =>
    !itUserIds.has(p.user_id) &&
    p.is_external !== true &&
    p.heartpace_sync_excluded !== true
);
```

**Resultat:** Kontona renderas inte i SVG-organisationsdiagrammet och påverkar inte hierarkin.

---

### 2.3 Vecko-celebrationer (födelsedagar/årsdagar)
**Fil:** `src/components/WeeklyCelebrations.tsx`

Databasfrågan exkluderar konton redan på query-nivå:

```typescript
supabase
  .from("profiles")
  .select("id, user_id, full_name, email, birthday, ...")
  .eq("is_hidden", false)
  .eq("is_external", false)          // Dölj externa
  .eq("heartpace_sync_excluded", false)  // Dölj exkluderade
```

**Resultat:** Inga födelsedagar eller arbetsjubileer visas för dessa konton på startsidan.

---

### 2.4 Kollega-recognition ("Kulturen")
**Fil:** `src/components/RecognitionDialog.tsx`

När användaren ska välja vem som ska hyllas filtreras listan:

```typescript
supabase
  .from("profiles")
  .select("id, user_id, full_name, ...")
  .eq("is_external", false)
  .eq("heartpace_sync_excluded", false)
```

**Resultat:** Externa och IT/Support-konton kan varken hyllas eller väljas som mottagare.

---

### 2.5 Planner (Kanban-tavlor)
**Fil:** `src/pages/Planner.tsx`

Vid tilldelning av kort till användare:

```typescript
supabase
  .from("profiles")
  .select("id, user_id, full_name, ...")
  .eq("is_external", false)
  .eq("heartpace_sync_excluded", false)
```

**Resultat:** Dessa konton visas inte i medlemslistan eller tilldelningsdropdown.

---

### 2.6 Chat
**Fil:** `src/pages/Chat.tsx`

Vid skapande av nya kanaler eller tilldelning:

```typescript
supabase
  .from("profiles")
  .select("id, user_id, full_name, ...")
  .eq("is_external", false)
  .eq("heartpace_sync_excluded", false)
```

**Resultat:** Dessa konton visas inte i chat-medlemslistan.

---

### 2.7 Orderformulär (godkännare/chefer)
**Fil:** `src/hooks/useOrderFormData.tsx`

När godkännare och chefer hämtas för beställningsflödet:

```typescript
// Godkännare
supabase
  .from("profiles")
  .select("...")
  .eq("is_external", false)
  .eq("heartpace_sync_excluded", false)

// Chefer  
supabase
  .from("profiles")
  .select("...")
  .eq("is_external", false)
  .eq("heartpace_sync_excluded", false)
```

**Resultat:** Externa och IT/Support-konton kan inte tilldelas som godkännare eller beställningschefer.

---

### 2.8 Heartpace-synkronisering
**Fil:** `supabase/functions/heartpace-sync-personnel/index.ts`

Edge-funktionen som synkar HR-data från Heartpace exkluderar dessa konton:

```typescript
const { data: profiles, error } = await supabase
  .from("profiles")
  .select("id, email, heartpace_id, ...")
  .eq("heartpace_sync_excluded", false)  // Hoppa över flaggade
  .eq("is_external", false);               // Hoppa över externa
```

**Resultat:** Dessa konton påverkas aldrig av automatisk HR-synkronisering och behåller sina manuellt satta värden.

---

## 3. Sammanfattning av visuell påverkan

| Vy/Komponent | IT/Support dold | Extern dold | Filtreringsnivå |
|--------------|-----------------|-------------|-----------------|
| `/personal` | Ja | Ja | Klient-side efter fetch |
| `/org` | Ja | Ja | Klient-side efter fetch |
| WeeklyCelebrations | Ja | Ja | Server-side (query) |
| RecognitionDialog | Ja | Ja | Server-side (query) |
| Planner | Ja | Ja | Server-side (query) |
| Chat | Ja | Ja | Server-side (query) |
| OrderFormData | Ja | Ja | Server-side (query) |
| Heartpace-sync | Ja | Ja | Edge Function query |

---

## 4. Underliggande databasmodell

### Kolumnersom styr synlighet

| Kolumn | Typ | Standard | Beskrivning |
|--------|-----|----------|-------------|
| `is_external` | `boolean` | `false` | Markerar konton skapade för personer utanför HF |
| `heartpace_sync_excluded` | `boolean` | `false` | Markerar konton som aldrig ska synkas från Heartpace |
| `is_hidden` | `boolean` | `false` | Generell dold-flagga (används separat för konton som ska döljas av andra skäl) |

---

## 5. Tillfälligt borttagna konton

Konton för personer som ännu inte officiellt börjat kan tas bort helt från systemet tills de registreras i Heartpace.

| Namn | Status | Åtgärd | Kommentar |
|------|--------|--------|-----------|
| Jürgen Vilhelmsson | Borttagen | `DELETE FROM profiles` | Ska synkas in från Heartpace när Petra lagt in honom där (börjar i februari) |
| Fredrik Klasson | Borttagen | `DELETE FROM profiles` | Inte längre anställd, ej i Heartpace |
| Niklas Bodell | Borttagen | `DELETE FROM profiles` | Inte längre anställd, ej i Heartpace |

**Resultat:** Posten finns inte längre i `profiles` och kommer synkas in automatiskt vid nästa Heartpace-synk när `heartpace_employee_id` matchas.

---

## 6. Edge Cases & Undantag

- Dessa konton kan fortfarande logga in och använda systemet (beroende på sina rollbehörigheter)
- De kan fortfarande ha admin- eller moderatorroller och komma åt adminpanelen
- De kan fortfarande skapa och hantera innehåll i moduler de har åtkomst till
- Döljningen är **visuell** – den påverkar inte databaslagring eller autentisering
