# Dolda sektioner på Kulturen-sidan

## Vad som är dolt
Följande sektioner på `/kulturen` visas **enbart för användare med IT-rollen** (gruppen IT):

1. **Veckans vinst** – den gula rutan högst upp med veckans framgångshistoria
2. **Karriärvägar på SHF** – sektionen längst ner med karriärstegsvisualisering

## Hur det fungerar
I `src/pages/Culture.tsx` kontrolleras `roles.includes("it")` via `useAuth()`.  
Båda sektionerna är omslutna med `{isIT && ( ... )}`.

## Hur du gör dem synliga för alla igen
I `src/pages/Culture.tsx`:

1. **Ta bort** raden `const isIT = roles.includes("it");` (rad ~40)
2. **Ta bort** `{isIT && (` och dess matchande `)}` runt **Veckans vinst**-blocket (sök efter kommentaren `{/* Veckans vinst`)
3. **Ta bort** `{isIT && (` och dess matchande `)}` runt **Karriärvägar**-blocket (sök efter kommentaren `{/* Karriärvägar`)

Alternativt kan du be AI:n: *"Gör Veckans vinst och Karriärvägar synliga för alla på kulturen-sidan"*
