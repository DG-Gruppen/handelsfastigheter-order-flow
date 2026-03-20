# Dolda sektioner på Dashboard-sidan

## Vad som är dolt
Följande sektioner på `/dashboard` visas **enbart för användare med IT-rollen** (gruppen IT):

1. **Veckans vinst** – kortet med veckans framgångshistoria
2. **OKR-snapshot** – kortet med OKR-framsteg och progress-bars

## Hur det fungerar
I `src/pages/Dashboard.tsx` kontrolleras `roles.includes("it")` via `useAuth()`.  
Båda sektionerna är omslutna med `{isIT && ( ... )}`.

## Hur du gör dem synliga för alla igen
I `src/pages/Dashboard.tsx`:

1. **Ta bort** raden `const isIT = roles.includes("it");` (rad ~21)
2. **Ta bort** `{isIT && (` och dess matchande `)}` runt **OKR-snapshot**-blocket (sök efter kommentaren `{/* ── OKR Snapshot (IT only)`)
3. **Ta bort** `{isIT && (` och dess matchande `)}` runt **Veckans vinst**-blocket (sök efter kommentaren `{/* ── Veckans vinst (IT only)`)

Alternativt kan du be AI:n: *"Gör Veckans vinst och OKR-snapshot synliga för alla på dashboarden"*
