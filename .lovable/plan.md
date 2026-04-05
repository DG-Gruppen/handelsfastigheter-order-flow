## Chattmodul för intranätet

### Fas 1: Databas & backend
1. **Tabeller** (migration):
   - `chat_channels` – kanaler (namn, beskrivning, typ: group/dm, ikon, skapad av)
   - `chat_channel_members` – kopplar användare till kanaler (för DM + ev. framtida begränsningar)
   - `chat_messages` – meddelanden (kanal, avsändare, innehåll, parent_message_id för trådar)
   - `chat_reactions` – emoji-reaktioner på meddelanden (user_id, message_id, emoji)
   - `chat_read_status` – spårar senast läst per kanal/användare (för oläst-räknare)
2. **RLS-policyer**: Alla autentiserade kan läsa/skriva i kanaler de är medlem i
3. **Realtime**: Aktivera realtime på `chat_messages` och `chat_reactions`

### Fas 2: Frontend – kanalvy
4. **Ny sida `/chatt`** med sidopanel (kanaler + DM-lista) och huvudvy (meddelandeflöde)
5. **Kanalhantering**: Skapa/redigera kanaler, söka kanaler
6. **DM**: Starta direktmeddelande med en kollega

### Fas 3: Meddelandeflöde
7. **Meddelandevy**: Scrollbar lista med meddelanden, avsändarens namn/avatar, tidsstämpel
8. **Skicka meddelande**: Textfält med Enter-skicka, emoji-picker
9. **Trådar**: Klicka på meddelande → öppna tråd-panel till höger
10. **Emoji-reaktioner**: Reagera på meddelanden med emoji

### Fas 4: Notiser & polish
11. **Oläst-räknare**: Visa antal olästa per kanal i sidopanelen
12. **Notiser**: Skapa notifikation vid omnämnande eller DM
13. **Modul-registrering**: Registrera som modul i `modules`-tabellen
14. **Route & navigation**: Lägg till i sidebar-navigationen

### Tekniska val
- Supabase Realtime för live-uppdateringar
- Markdown-rendering (react-markdown) för meddelanden
- Emoji-picker via befintliga `@emoji-mart/*`-paket
- Befintligt notifikationssystem för push-notiser
