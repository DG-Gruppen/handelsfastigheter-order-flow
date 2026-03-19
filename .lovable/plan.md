

## Fix: Checklista-knappen i högermenyn

### Problem
Det finns två "Lägg till checklista"-knappar:
1. **Högermenyn (sidebar)** – rad 334 i `CardDetailDialog.tsx` – gör ingenting (`onClick` är tom)
2. **Inuti CardChecklists** – "Lägg till checklista"-knappen längst ner i komponenten – fungerar

Användaren vill att sidebar-knappen ska vara den enda som fungerar.

### Lösning

**CardChecklists.tsx:**
- Exponera `addChecklist`-funktionen via en callback-prop (`onAddChecklist`) eller `useImperativeHandle`
- Ta bort den interna "Lägg till checklista"-knappen längst ner i komponenten

**CardDetailDialog.tsx:**
- Håll en ref eller callback till `addChecklist`
- Koppla sidebar-knappen (rad 334) till att anropa `addChecklist` på CardChecklists

### Implementation
Enklast: lägg till en `addChecklistRef`-prop på CardChecklists som sätter en extern referens till `addChecklist`-funktionen. Alternativt `forwardRef` + `useImperativeHandle`. Callback-ref är enklare:

```tsx
// CardChecklists: ta emot prop
onRegisterAdd?: (fn: () => void) => void;
// Anropa i useEffect: onRegisterAdd?.(() => addChecklist);

// CardDetailDialog: spara referensen
const addChecklistRef = useRef<() => void>();
<CardChecklists cardId={card.id} onRegisterAdd={fn => addChecklistRef.current = fn} />
<SidebarButton icon={CheckSquare} label="Checklista" onClick={() => addChecklistRef.current?.()} />
```

### Filer som ändras
- `src/components/planner/CardChecklists.tsx` – ta bort intern knapp, exponera addChecklist via prop
- `src/components/planner/CardDetailDialog.tsx` – koppla sidebar-knappen till addChecklist

