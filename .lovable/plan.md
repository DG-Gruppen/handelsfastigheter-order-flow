

## Integrations Admin View

### Summary
Add a new "Integrationer" section in the admin panel that shows the status, last sync time, and any errors for all external integrations (Cision RSS, E-post/Resend, AI-chat, Firecrawl/Scraping, Document extraction).

### What the user will see
A new admin card "Integrationer" under "Systeminställningar" in the admin panel. Clicking it opens a dashboard with cards for each integration showing:
- Name and icon
- Status indicator (green/yellow/red)
- Last successful sync timestamp
- Error count and last error message
- A "Test" button to ping each integration

### Technical approach

**1. Database table: `integration_status`**
- Columns: `id`, `slug` (unique), `name`, `last_sync_at`, `last_error`, `error_count`, `status` (enum: ok/warning/error), `metadata` (jsonb), `updated_at`
- RLS: admin/IT can read and write
- Edge functions will upsert rows after each run (Cision feed, email queue, scraping, etc.)

**2. Update existing edge functions**
- Add a small helper that upserts `integration_status` after each run completes (success or failure)
- Applies to: `fetch-cision-feed`, `process-email-queue`, `sync-content-index`, `extract-document-text`

**3. New component: `IntegrationsStatus.tsx`**
- Fetches from `integration_status` table
- Displays cards per integration with status badge, timestamp, error info
- "Test connection" button that invokes each edge function with a dry-run flag

**4. Wire into Admin panel**
- Add "integrations" to `AdminSection` type and `adminGroups` in `Admin.tsx`
- Add to `SECTION_SLUG_MAP` in `useAdminAccess.tsx` (admin-only: `null`)
- Lazy-load the new component

### Files to create/edit
| File | Action |
|------|--------|
| Migration SQL | Create `integration_status` table with RLS |
| `src/components/admin/IntegrationsStatus.tsx` | New component |
| `src/pages/Admin.tsx` | Add section entry |
| `src/hooks/useAdminAccess.tsx` | Add mapping |
| `supabase/functions/fetch-cision-feed/index.ts` | Add status upsert |
| `supabase/functions/process-email-queue/index.ts` | Add status upsert |
| `supabase/functions/sync-content-index/index.ts` | Add status upsert |
| `supabase/functions/extract-document-text/index.ts` | Add status upsert |

### Regarding Lovable's API capability
Lovable handles REST API integrations well through Edge Functions. Strengths: secret management, CORS, JWT validation, typed responses. Limitations: no WebSockets, no long-running processes (>60s), no traditional server middleware. For standard REST API integrations this is fully sufficient.

