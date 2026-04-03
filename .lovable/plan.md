## Extern åtkomst – Implementeringsplan

### Steg 1: Databasändringar
- Lägg till `is_external` boolean på `profiles`
- Skapa `external_invites` tabell (token, email, invited_by, expires_at, accepted_at, group_ids[])
- RLS: admins kan hantera inbjudningar, externa kan bara läsa sin egen profil

### Steg 2: Edge Function – Acceptera inbjudan
- `/accept-external-invite` – validerar token, skapar konto (auto-confirm), sätter `is_external = true`, lägger till i rätt grupper

### Steg 3: Dedikerad extern inloggningssida
- `/extern` – ren inloggningssida utan Google SSO, bara e-post/lösenord
- `/extern/invite/:token` – landing page för inbjudningslänk, visar info + "Skapa konto"-formulär
- Separat design/branding som signalerar "extern portal"

### Steg 4: Filtrerad navigation för externa
- Sidebaren visar bara moduler de har `can_view` på
- Dölja admin-panel, org-chart, lösenord, kultur-sidor etc.
- Lägg till "Extern"-badge i headern

### Steg 5: Admin-vy för hantering
- Ny sektion i admin-panelen: "Externa parter"
- Bjud in via e-post, välj grupp/moduler
- Lista aktiva externa med möjlighet att revokera åtkomst

### Tekniska detaljer
- E-postdomänrestriktionen i Login.tsx behöver utökas eller bypassa för externa konton
- Auto-confirm aktiveras INTE globalt – bara via edge function med service role
- Externa konton exkluderas från interna listor (som `is_hidden`-profiler gör idag)
