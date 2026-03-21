## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- System: SHF Intra
- Package Version: 3.10.0
- Last Reviewed: 2026-03-21
- Status: Active
- Source of Truth: Yes — for system purpose, module inventory, route map, DB table inventory, Edge Function inventory, integration list, and known complexity areas
- Depends On: *(none — this is the root document)*
- Used By: All other ai-docs files
- Owner: DG Gruppen
- Update Triggers: new module, new route, new table, new Edge Function, new integration, role change, scope change

---

## 1. Systembeskrivning

SHF Intra är ett internt intranät och beställningssystem byggt för **Svenska Handelsfastigheter (SHF)**. Systemet används av samtliga anställda — från VD till nyanställda — för att hantera IT-beställningar, onboarding/offboarding, nyheter, dokument, kunskapsbank, lösenordsdelning, projektplanering och organisationsöversikt.

Applikationen är en **React SPA** (Vite + TypeScript + Tailwind CSS) med **Supabase** som backend (PostgreSQL, Auth, Storage, Edge Functions). All åtkomstkontroll drivs av ett **gruppstyrt rollsystem** där roller härleds dynamiskt från gruppmedlemskap via `groups.role_equivalent`, inte genom manuell tilldelning i `user_roles`.

Målgruppen är ~50–200 medarbetare inom SHF-koncernen. Systemet löser problemet med fragmenterad intern kommunikation, manuella beställningsflöden och decentraliserad dokumenthantering.

---

## 2. Användarroller

Roller definieras som enum `app_role` och härleds primärt via gruppmedlemskap (`group_members` → `groups.role_equivalent`).

| Roll | Beskrivning | Nyckelbehörigheter |
|------|------------|-------------------|
| `admin` | Full systemåtkomst | Alla CRUD-operationer, användarhantering, impersonation, modulkonfiguration, backup |
| `it` | IT-personal, admin-ekvivalent för panelåtkomst | Impersonation, universell modulåtkomst (owner/edit/view), sökindexering, FAQ-hantering |
| `manager` | Chef med attestansvar | Godkänna/avvisa beställningar, se underordnades ordrar, organisationsöversikt |
| `staff` | Utökad åtkomst (STAB) | Synlighet i org-schema som stabsfunktion, utökad modulåtkomst |
| `employee` | Basroll för autentiserade användare | Skapa beställningar, läsa nyheter/KB, använda verktyg, grundläggande dokumentåtkomst |

**Specialfall:**
- En dold **Superadmin**-grupp (`is_system: true`) med `role_equivalent = 'admin'` filtreras bort från alla publika vyer
- Roller ackumuleras med OR-logik — en användare i flera grupper får den högsta rättighetsnivån
- `user_roles`-tabellen finns men hålls tom; all rollstyrning sker via grupper

---

## 3. Moduler och funktionsområden

Moduler registreras i tabellen `modules` med slug, route och ikon. Åtkomst styrs av `module_role_access` (rollbaserat) och `module_permissions` (grupp-/användarspecifikt).

### 3.1 Dashboard & Hem

| Egenskap | Värde |
|----------|-------|
| Slug | `home` |
| Route | `/dashboard` |
| Sida | `Dashboard.tsx` |
| Åtkomst | Alla autentiserade |
| DB-tabeller | `orders`, `notifications`, `news` (läsning) |
| Beskrivning | Personlig översikt med pågående beställningar, senaste nyheter, snabblänkar, firanden |

### 3.2 Nyheter

| Egenskap | Värde |
|----------|-------|
| Slug | `nyheter` |
| Route | `/nyheter` |
| Sida | `News.tsx` |
| Åtkomst | Alla autentiserade (läsa); admin + modulbehörighet `nyheter.edit` (skapa/redigera) |
| DB-tabeller | `news` |
| Edge Functions | `fetch-cision-feed` (automatisk import var 12:e timme) |
| Komplexitet | Cision RSS-import med deduplicering via `source_url`; pagination efter 8 artiklar |

### 3.3 Kunskapsbanken

| Egenskap | Värde |
|----------|-------|
| Slug | `kunskapsbanken` |
| Route | `/kunskapsbanken` |
| Sida | `KnowledgeBase.tsx` |
| Åtkomst | Alla autentiserade (publicerade); admin + modulbehörighet `kunskapsbanken.edit` (hantera) |
| DB-tabeller | `kb_articles`, `kb_videos`, `kb_categories` |
| Beskrivning | Artiklar och videor med rich text (TipTap), kategorier och taggning |

### 3.4 Dokumentbibliotek

| Egenskap | Värde |
|----------|-------|
| Slug | `documents` |
| Route | `/dokument` |
| Sida | `Documents.tsx` |
| Åtkomst | Rollbaserad per mapp via `access_roles`/`write_roles`; admin har full åtkomst |
| DB-tabeller | `document_folders`, `document_files` |
| Storage | Bucket `documents` (privat) |
| DB-funktioner | `has_folder_access()`, `has_folder_write_access()` |

### 3.5 Beställningar (New Order)

| Egenskap | Värde |
|----------|-------|
| Slug | `new-order` |
| Route | `/orders/new` |
| Sida | `NewOrder.tsx` |
| Åtkomst | Alla autentiserade |
| DB-tabeller | `orders`, `order_items`, `order_types`, `order_systems`, `categories`, `systems` |
| Beskrivning | Beställningsformulär för IT-utrustning med dynamiska utrustningsval och automatisk chef-tilldelning |

### 3.6 Onboarding/Offboarding

| Egenskap | Värde |
|----------|-------|
| Slug | `onboarding` |
| Route | `/onboarding` |
| Sida | `Onboarding.tsx` |
| Åtkomst | Alla autentiserade (begränsningar per roll i UI) |
| DB-tabeller | `orders`, `order_items`, `profiles` |
| Komplexitet | Skapar placeholder-profiler vid onboarding; låst avdelning för chefer; auto-godkänning för VD/STAB/IT/chefer utan chef |

### 3.7 Beställningshistorik

| Egenskap | Värde |
|----------|-------|
| Slug | `history` |
| Route | `/history` |
| Sida | `History.tsx` |
| Åtkomst | Egna ordrar + chefers underordnade + admin alla |
| DB-tabeller | `orders`, `order_items` |

### 3.8 Organisationsschema

| Egenskap | Värde |
|----------|-------|
| Slug | `org` |
| Route | `/org` |
| Sida | `OrgTree.tsx` |
| Åtkomst | Alla autentiserade (läsa); admin (redigera) |
| DB-tabeller | `profiles`, `departments`, `org_chart_settings` |
| Komplexitet | SVG-canvas med drag-and-drop, kollapsade noder (localStorage), realtidssynk med debounce |

### 3.9 Personal

| Egenskap | Värde |
|----------|-------|
| Slug | `personnel` |
| Route | `/personal` |
| Sida | `Personnel.tsx` |
| Åtkomst | Alla autentiserade |
| DB-tabeller | `profiles`, `departments` |

### 3.10 IT-support

| Egenskap | Värde |
|----------|-------|
| Slug | `it-support` |
| Route | `/it-info` |
| Sida | `ITInfo.tsx` |
| Åtkomst | Alla autentiserade (läsa); admin + modulbehörighet `it-support.edit` (redigera FAQ) |
| DB-tabeller | `it_faq` |

### 3.11 Planner (Kanban)

| Egenskap | Värde |
|----------|-------|
| Slug | `planner` |
| Route | `/planner` |
| Sida | `Planner.tsx` |
| Åtkomst | Alla autentiserade (skapa/visa); admin + modulbehörighet `planner.edit` (hantera tavlor) |
| DB-tabeller | `planner_boards`, `planner_columns`, `planner_cards`, `planner_checklists`, `planner_checklist_items`, `planner_card_comments`, `planner_card_attachments`, `planner_activity_log` |
| Komplexitet | Drag-and-drop (dnd-kit), WIP-gränser, aktivitetslogg, checklistor, kommentarer med notifikationer |

### 3.12 Verktyg

| Egenskap | Värde |
|----------|-------|
| Slug | `tools` |
| Route | `/verktyg` |
| Sida | `Tools.tsx` |
| Åtkomst | Alla autentiserade |
| DB-tabeller | `tools`, `user_tool_favorites` |

### 3.13 Lösenordshanterare

| Egenskap | Värde |
|----------|-------|
| Slug | `losenord` |
| Route | `/losenord` |
| Sida | `Passwords.tsx` |
| Åtkomst | Gruppbaserad via `shared_password_groups`; admin/IT kan se accesslogg |
| DB-tabeller | `shared_passwords`, `shared_password_groups`, `password_access_log` |
| Edge Functions | `get-passwords-key` |
| DB-funktioner | `has_shared_password_access()` |
| Komplexitet | AES-kryptering på klientsidan; krypteringsnyckeln returneras av Edge Function |

### 3.14 Kulturen

| Egenskap | Värde |
|----------|-------|
| Slug | `kulturen` |
| Route | `/kulturen` |
| Sida | `Culture.tsx` |
| Åtkomst | Alla autentiserade |
| DB-tabeller | `recognitions`, `celebration_comments`, `profiles` (födelsedagar/jubileum) |

### 3.15 Arbetskläder

| Egenskap | Värde |
|----------|-------|
| Slug | `workwear` |
| Route | `/arbetsklader` |
| Sida | `Workwear.tsx` |
| Åtkomst | Alla autentiserade |
| DB-tabeller | `workwear_orders` |
| Edge Functions | `notify-workwear-season` |

### 3.16 Mitt SHF

| Egenskap | Värde |
|----------|-------|
| Slug | `my-shf` |
| Route | `/mitt-shf` |
| Sida | `MySHF.tsx` |
| Åtkomst | Alla autentiserade |

### 3.17 Admin-panel

| Egenskap | Värde |
|----------|-------|
| Slug | `admin` |
| Route | `/admin` |
| Sida | `Admin.tsx` |
| Åtkomst | admin-roll eller valfri modulbehörighet med edit-rättighet |
| Beskrivning | Flikar: Användare, Inställningar (moduler, avdelningar, order-typer, kategorier, system), Grupper, IT (sökindex, impersonation, backup), Modulbehörigheter |
| Hooks | `useAdminAccess` |

---

## 4. Navigationsstruktur

### Rutter

| Path | Sida | Åtkomst |
|------|------|---------|
| `/login` | `Login.tsx` | Publik |
| `/` | Redirect → `/dashboard` | — |
| `/dashboard` | `Dashboard.tsx` | Autentiserad |
| `/orders/new` | `NewOrder.tsx` | Autentiserad |
| `/onboarding` | `Onboarding.tsx` | Autentiserad |
| `/orders/:id` | `OrderDetail.tsx` | Autentiserad (ägare/attestant/admin) |
| `/history` | `History.tsx` | Autentiserad |
| `/admin` | `Admin.tsx` | Admin eller edit-behörighet |
| `/org` | `OrgTree.tsx` | Autentiserad |
| `/it-info` | `ITInfo.tsx` | Autentiserad |
| `/personal` | `Personnel.tsx` | Autentiserad |
| `/dokument` | `Documents.tsx` | Autentiserad (rollfiltrerad) |
| `/kunskapsbanken` | `KnowledgeBase.tsx` | Autentiserad |
| `/mitt-shf` | `MySHF.tsx` | Autentiserad |
| `/planner` | `Planner.tsx` | Autentiserad |
| `/verktyg` | `Tools.tsx` | Autentiserad |
| `/losenord` | `Passwords.tsx` | Autentiserad (gruppfiltrerad) |
| `/kulturen` | `Culture.tsx` | Autentiserad |
| `/nyheter` | `News.tsx` | Autentiserad |
| `/arbetsklader` | `Workwear.tsx` | Autentiserad |
| `/profile` | `Profile.tsx` | Autentiserad |
| `*` | `NotFound.tsx` | — |

### Sidofältsstruktur (desktop)

Grupper definieras i `AppSidebar.tsx` → `GROUP_CONFIG`:

| Grupp | Slugs |
|-------|-------|
| Information | `nyheter`, `strategy`, `kunskapsbanken`, `documents` |
| Beställningar | `new-order`, `onboarding`, `history` |
| Organisation | `org`, `personnel`, `kulturen`, `workwear`, `pulse` |
| IT & Verktyg | `it-support`, `planner`, `tools`, `losenord` |
| Personligt | `my-shf` |

Admin nås via profilmenyn, inte sidofältet.

---

## 5. Databasstruktur

### 5.1 Identitet & åtkomst

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `profiles` | Utökar `auth.users` med namn, avdelning, chef | `id`, `user_id`, `full_name`, `email`, `department`, `manager_id`, `birthday`, `start_date`, `is_hidden`, `is_staff`, `sort_order`, `title_override` | `manager_id` → `profiles.id` (self-ref) |
| `user_roles` | Roll per användare (hålls tom — roller härleds via grupper) | `user_id`, `role` (app_role enum) | — |
| `groups` | Namngivna behörighetsgrupper | `id`, `name`, `role_equivalent`, `is_system`, `color` | — |
| `group_members` | Koppling användare ↔ grupp | `user_id`, `group_id` | `group_id` → `groups.id` |
| `departments` | Avdelningshierarki | `id`, `name`, `color`, `parent_id` | `parent_id` → `departments.id` (self-ref) |

### 5.2 Modulsystem

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `modules` | Register över funktionsmoduler | `id`, `name`, `slug`, `route`, `icon`, `is_active`, `sort_order` | — |
| `module_role_access` | Rollbaserad standardåtkomst per modul | `module_id`, `role`, `has_access` | `module_id` → `modules.id` |
| `module_permissions` | Finkorning per-användare/grupp-behörighet | `module_id`, `grantee_type`, `grantee_id`, `can_view`, `can_edit`, `can_delete`, `is_owner` | `module_id` → `modules.id` |
| `module_activity_log` | Aktivitetslogg per modul | `module_id`, `user_id`, `action`, `entity_type`, `entity_id` | `module_id` → `modules.id` |

### 5.3 Beställningar

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `orders` | Beställningar | `id`, `requester_id`, `approver_id`, `status`, `category`, `title`, `order_type_id`, `recipient_*` | `order_type_id` → `order_types.id`, `category_id` → `categories.id` |
| `order_items` | Rader per beställning | `order_id`, `name`, `quantity`, `category_id`, `order_type_id` | `order_id` → `orders.id` |
| `order_types` | Beställningstyper | `id`, `name`, `category`, `category_id`, `icon`, `is_active` | `category_id` → `categories.id` |
| `categories` | Utrustningskategorier | `id`, `name`, `icon`, `is_active`, `sort_order` | — |
| `systems` | IT-system (kopplas till ordrar) | `id`, `name`, `description`, `icon`, `is_active` | — |
| `order_systems` | Koppling order ↔ system | `order_id`, `system_id` | → `orders.id`, `systems.id` |
| `order_type_departments` | Koppling ordertyp ↔ avdelning | `order_type_id`, `department_id` | → `order_types.id`, `departments.id` |
| `category_departments` | Koppling kategori ↔ avdelning | `category_id`, `department_id` | → `categories.id`, `departments.id` |

### 5.4 Dokument

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `document_folders` | Mapphierarki med rollbaserad åtkomst | `id`, `name`, `parent_id`, `access_roles`, `write_roles`, `created_by` | `parent_id` → self |
| `document_files` | Filer i mappar | `id`, `name`, `storage_path`, `mime_type`, `file_size`, `folder_id`, `created_by` | `folder_id` → `document_folders.id` |

### 5.5 Lösenord

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `shared_passwords` | AES-krypterade lösenord | `id`, `service_name`, `username`, `password_value`, `url`, `notes`, `created_by` | — |
| `shared_password_groups` | Koppling lösenord ↔ grupp | `password_id`, `group_id` | → `shared_passwords.id`, `groups.id` |
| `password_access_log` | Åtkomstlogg | `password_id`, `user_id`, `action` | → `shared_passwords.id` |

### 5.6 Planner

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `planner_boards` | Kanban-tavlor | `id`, `name`, `created_by`, `is_archived` | — |
| `planner_columns` | Kolumner per tavla | `board_id`, `name`, `sort_order`, `wip_limit` | → `planner_boards.id` |
| `planner_cards` | Kort | `board_id`, `column_id`, `assignee_id`, `reporter_id`, `priority`, `due_date`, `labels` | → `planner_boards.id`, `planner_columns.id` |
| `planner_checklists` | Checklistor per kort | `card_id`, `title`, `sort_order` | → `planner_cards.id` |
| `planner_checklist_items` | Checklistepunkter | `checklist_id`, `text`, `checked` | → `planner_checklists.id` |
| `planner_card_comments` | Kommentarer | `card_id`, `user_id`, `content` | → `planner_cards.id` |
| `planner_card_attachments` | Bilagor | `card_id`, `storage_path`, `uploaded_by` | → `planner_cards.id` |
| `planner_activity_log` | Aktivitetslogg | `board_id`, `user_id`, `action`, `entity_type` | → `planner_boards.id` |

### 5.7 Nyheter & innehåll

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `news` | Nyhetsartiklar (interna + Cision) | `title`, `body`, `source` (internal/cision), `is_published`, `author_id`, `source_url`, `published_at` | — |
| `ceo_blog` | VD-blogg | `title`, `excerpt`, `author`, `period` | — |
| `content_index` | Sökindex för AI-assistent | `source_table`, `source_id`, `title`, `content`, `fts` (tsvector) | — |

### 5.8 Kunskapsbank

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `kb_articles` | Artiklar | `title`, `content`, `slug`, `category_id`, `is_published`, `tags`, `author_id` | → `kb_categories.id` |
| `kb_videos` | Videor | `title`, `video_url`, `category_id`, `is_published`, `tags`, `author_id` | → `kb_categories.id` |
| `kb_categories` | Kategorier | `name`, `slug`, `is_active` | — |

### 5.9 Kultur & erkännanden

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `recognitions` | Kollegiala erkännanden | `from_user_id`, `to_user_id`, `message`, `icon` | — |
| `celebration_comments` | Firandekommentarer | `user_id`, `week_key`, `message` | — |

### 5.10 E-postsystem

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `email_send_log` | Sändningslogg | `message_id`, `template_name`, `recipient_email`, `status` | — |
| `email_send_state` | Enrads rate-limit-konfiguration | `retry_after_until`, `batch_size`, `send_delay_ms` | — |
| `email_unsubscribe_tokens` | Avregistreringslänkar | `email`, `token`, `used_at` | — |
| `suppressed_emails` | Blockerade mottagare | `email`, `reason` | — |

### 5.11 Övrigt

| Tabell | Syfte | Nyckelkolumner | Relationer |
|--------|-------|----------------|------------|
| `notifications` | In-app-notifikationer | `user_id`, `title`, `type`, `is_read`, `reference_id` | — |
| `org_chart_settings` | Nyckel-värde-inställningar för org-schema | `setting_key`, `setting_value` | — |
| `tools` | Externa verktygslänkar | `name`, `url`, `emoji`, `is_active` | — |
| `user_tool_favorites` | Favoriter per användare | `user_id`, `tool_id`, `sort_order` | → `tools.id` |
| `workwear_orders` | Arbetsklädbeställningar | `user_id`, `items` (JSON), `status` | — |
| `it_faq` | IT-FAQ | `question`, `answer`, `is_active`, `sort_order` | — |

### 5.12 Enum-typer

| Enum | Värden | Används i |
|------|--------|-----------|
| `app_role` | `employee`, `manager`, `admin`, `staff`, `it` | `user_roles.role`, `module_role_access.role`, `groups.role_equivalent` |
| `order_status` | `pending`, `approved`, `rejected`, `delivered` | `orders.status` |
| `order_category` | `computer`, `phone`, `peripheral`, `other` | `orders.category`, `order_types.category` |

---

## 6. Backend-funktioner (Edge Functions)

| Funktion | Syfte | Anropas av | JWT |
|----------|-------|-----------|-----|
| `ai-chat` | AI-assistent (SHF-Assistenten) — söker i `content_index` och genererar svar via Lovable AI | Klient (`AiChatBubble.tsx`) | Ja |
| `fetch-cision-feed` | Hämtar nyheter från Cision RSS-feed och importerar som nyhetsartiklar i `news`-tabellen | pg_cron (var 12:e timme) | Nej |
| `send-email` | Skickar e-post via Resend API | Andra Edge Functions | Ja |
| `process-email-queue` | Bearbetar pgmq-kö (`auth_emails`, `transactional_emails`) | pg_cron | Ja |
| `database-backup` | Exporterar alla 48 publika tabeller som JSON-backup | Admin-panel (`DatabaseBackup.tsx`) | Nej |
| `get-passwords-key` | Returnerar AES-krypteringsnyckel för lösenord | Klient (`Passwords.tsx`) | Ja |
| `impersonate-user` | Genererar session-token för annan användare (IT/admin) | Admin-panel (`ImpersonateUserCard.tsx`) | Ja |
| `import-google-workspace` | Importerar användare från Google Workspace | Admin-panel | Ja |
| `sync-content-index` | Batch-synk av sökindex | pg_cron (nattlig) | Ja |
| `scrape-website` | Skrapar webbsidor för sökindex (Firecrawl) | Admin-panel / pg_cron | Ja |
| `scrape-allabolag` | Hämtar bolagsinformation | pg_cron | — |
| `cleanup-notifications` | Rensar gamla notifikationer | pg_cron | — |
| `notify-workwear-season` | Skickar påminnelse om arbetsklädbeställning | pg_cron | — |
| `seed-demo-data` | Skapar testdata | Manuell | — |
| `extract-document-text` | Extraherar text från PDF/DOCX/XLSX/text-filer och indexerar i `content_index` | DB-trigger (`notify_extract_document_text`) via pg_net | Nej |

### Nyckel-DB-funktioner (RPC)

| Funktion | Syfte |
|----------|-------|
| `has_role(_user_id, _role)` | Kontrollerar roll via `user_roles` + `group_members` → `groups.role_equivalent` |
| `has_module_permission(_user_id, _module_id, _permission)` | Kontrollerar modulbehörighet (user + group) |
| `has_module_slug_permission(_user_id, _slug, _permission)` | Som ovan men med modul-slug |
| `has_folder_access(_user_id, _folder_id)` | Kontrollerar mappåtkomst via `access_roles` |
| `has_folder_write_access(_user_id, _folder_id)` | Kontrollerar skrivåtkomst (roll + modulbehörighet) |
| `has_shared_password_access(_user_id, _password_id)` | Kontrollerar lösenordsåtkomst via gruppmedlemskap |
| `get_subordinate_user_ids(_manager_profile_id)` | Rekursiv CTE för att hämta alla underordnade |
| `get_manager_user_ids()` | Returnerar alla användare med manager-roll |
| `search_content(query_text, match_limit)` | Hybridsökning (fulltext + trigram) i `content_index` |
| `create_notification(...)` | Skapar notifikation (SECURITY DEFINER) |
| `handle_new_user()` | Trigger: skapar/länkar profil vid ny auth-användare |

### Databastriggers

| Trigger | Tabell | Syfte |
|---------|--------|-------|
| `index_news` | `news` | Synkar publicerade nyheter till `content_index` |
| `index_kb_article` | `kb_articles` | Synkar publicerade artiklar till `content_index` |
| `index_kb_video` | `kb_videos` | Synkar publicerade videor till `content_index` |
| `index_it_faq` | `it_faq` | Synkar aktiva FAQ till `content_index` |
| `index_ceo_blog` | `ceo_blog` | Synkar VD-blogg till `content_index` |
| `index_tools` | `tools` | Synkar aktiva verktyg till `content_index` |
| `index_department` | `departments` | Synkar avdelningar till `content_index` |
| `index_document_file` | `document_files` | Synkar dokument-metadata till `content_index` |
| `notify_extract_document_text` | `document_files` | Anropar `extract-document-text` Edge Function via pg_net för att extrahera filinnehåll |
| `index_document_folder` | `document_folders` | Synkar mappar till `content_index` |
| `notify_new_document_file` | `document_files` | Skapar notifikationer vid nya dokument |
| `notify_kb_article_published` | `kb_articles` | Notifierar vid publicerad artikel |
| `notify_kb_video_published` | `kb_videos` | Notifierar vid publicerad video |
| `notify_planner_card_assigned` | `planner_cards` | Notifierar vid korttilldelning |
| `notify_planner_card_comment` | `planner_card_comments` | Notifierar vid ny kommentar |
| `handle_new_user` | `auth.users` | Skapar/länkar profil (auth-trigger) |

---

## 7. Nyckel-hooks och utilities

| Hook/Utility | Ansvar | Används av |
|-------------|--------|-----------|
| `useAuth` (`hooks/useAuth.tsx`) | Autentisering, session, profil, rollhärledning | Alla skyddade sidor |
| `useModules` (`hooks/useModules.tsx`) | Hämtar tillgängliga moduler baserat på roll/grupp | `AppSidebar`, `ProtectedRoute` |
| `useModulePermission` (`hooks/useModulePermission.tsx`) | Kontrollerar specifik modulbehörighet | Modulspecifika sidor |
| `useAdminAccess` (`hooks/useAdminAccess.tsx`) | Avgör om användaren har tillgång till admin-panelen | `AppSidebar`, `Admin.tsx` |
| `useDocuments` (`hooks/useDocuments.tsx`) | CRUD för dokument/mappar | `Documents.tsx` |
| `useNavSettings` (`hooks/useNavSettings.tsx`) | Navigeringsinställningar | `AppSidebar` |
| `ProtectedRoute` (`components/ProtectedRoute.tsx`) | Route guard — omdirigerar oautentiserade till `/login` | `App.tsx` |
| `ImpersonationBanner` (`components/ImpersonationBanner.tsx`) | Visar banner vid aktiv impersonation | `AppLayout.tsx` |
| `passwordCrypto` (`lib/passwordCrypto.ts`) | AES-kryptering/dekryptering för lösenord | `Passwords.tsx` |
| `emailTemplates` (`lib/emailTemplates.ts`) | HTML-mallar för transaktionella e-postmeddelanden | Edge Functions |
| `orderEmails` (`lib/orderEmails.ts`) | E-postlogik för beställningsnotifieringar | `NewOrder.tsx`, `OrderDetail.tsx` |

---

## 8. Integrationer

| Integration | Typ | Syfte | Konfiguration |
|------------|-----|-------|---------------|
| **Supabase Auth** | Autentisering | Inloggning med e-post/lösenord | Inbyggd |
| **Supabase Storage** | Fillagring | Dokument (bucket `documents`), KB-bilder (bucket `kb-images`) | Inbyggd |
| **Resend** | E-post | Transaktionella e-postmeddelanden (beställningar, notifikationer) | Secret: `RESEND_API_KEY` |
| **Cision RSS** | Nyhetsimport | Automatisk import av pressmeddelanden var 12:e timme | URL i `fetch-cision-feed` |
| **Firecrawl** | Webbskrapning | Skrapar webbsidor för AI-sökindex | Secret: `FIRECRAWL_API_KEY` |
| **Lovable AI** | AI-modeller | SHF-Assistenten (chat), innehållsgenerering | Secret: `LOVABLE_API_KEY` |
| **Allabolag** | Bolagsdata | Hämtar bolagsinformation | `scrape-allabolag` Edge Function |
| **Google Workspace** | Användarimport | Importerar medarbetare till `profiles` | `import-google-workspace` Edge Function |
| **pgmq** | Meddelandekö | E-postkö med DLQ-hantering | DB-extension |
| **pg_cron** | Schemaläggning | Nattliga synkjobb, Cision-import, notifikationsrensning | DB-extension |

---

## 9. Kända komplexitetsområden

### Beställningsflöde (`NewOrder.tsx`, `Onboarding.tsx`, `OrderDetail.tsx`)
- Auto-godkänning baseras på rollkontroller och chef-hierarki
- Placeholder-profiler skapas vid onboarding och länkas via `handle_new_user()`-triggern
- Statustransitioner är klient-drivna — ingen server-side state machine
- Approver kan tekniskt ändra alla fält vid UPDATE (saknar column-level restriction)

### Rollhärledning (`useAuth.tsx`, `has_role()`)
- Roller härleds från två källor: `user_roles` (hålls tom) + `group_members` → `groups.role_equivalent`
- `has_role()` DB-funktionen kontrollerar båda källorna
- Superadmin-gruppen är dold via `is_system: true`-filtrering i frontend

### Lösenordskryptering (`Passwords.tsx`, `get-passwords-key`)
- AES-nyckeln returneras till alla autentiserade användare oavsett gruppmedlemskap
- Gruppfiltrering sker i RLS-policy på `shared_passwords` men nyckeln är global

### Sökindex (`content_index`, `ai-chat`)
- Dual-indexering: realtid via triggers + batch via `sync-content-index`
- Risk för divergens vid trigger-failure

### Dokumentåtkomst (`document_folders`, `document_files`)
- Storage bucket `documents` har separat RLS som kanske inte matchar mapp-nivå `access_roles`
- Potentiell URL-bypass-risk

### Org-schema (`OrgChartCanvas.tsx`)
- SVG-canvas med komplex trädkonstruktion (useMemo/Map-lookup)
- `profiles.department` är fritext, inte FK till `departments` — matchning via string equality

---

## 10. Vad systemet INTE är

- **Inte ett externt kundsystem** — enbart för interna SHF-medarbetare
- **Inte ett ekonomisystem** — hanterar inte fakturering, budgetar eller transaktioner
- **Inte en native mobilapp** — responsiv webbapp (PWA-stöd via `vite-plugin-pwa`)
- **Inte ett lager-/logistiksystem** — beställningar spårar godkännande, inte leveranslogistik
- **Inte ett ärendehanteringssystem** — Planner är en enkel kanban, inte Jira/ServiceNow
- **Inte ett chat-/meddelandesystem** — AI-assistenten är en sökbaserad Q&A, inte realtidschat
- **Har ingen SSO/SAML** — autentisering sker via e-post/lösenord i Supabase Auth
- **Hanterar inte löneinformation** — profiler innehåller namn, avdelning och kontaktuppgifter, inte lönedata

---

## Ändringslogg

| Datum | Vad ändrades |
|-------|-------------|
| 2026-03-21 | Initial version — komplett systembeskrivning genererad från kodbasen |
| 2026-03-21 | Lade till `extract-document-text` Edge Function och `notify_extract_document_text` trigger för automatisk textextraktion från dokument |
