## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- Last Reviewed: 2026-03-21
- Evidence Scope: public repository tree plus existing repo docs
- Confidence: medium
- Owner: DG Gruppen
- Update Triggers: app shell changes, route changes, Supabase client/function/migration changes

## Verified Structure
Top-level paths observed:
- `.lovable`
- `docs`
- `public`
- `src`
- `supabase`

Frontend paths observed under `src`:
- `assets`
- `components`
- `data`
- `hooks`
- `integrations`
- `lib`
- `pages`
- `test`

Backend-adjacent paths observed under `supabase`:
- `functions`
- `migrations`
- `config.toml`

## Trust Boundary
- `src/**` is client-side and untrusted for final authorization.
- `supabase/functions/**`, database policies, migrations, and server-side procedures are the likely enforcement boundary.

## Practical Reading Order for Code Review
1. `src/main.tsx`
2. `src/App.tsx`
3. auth and module hooks
4. protected routes and admin pages
5. order pages
6. `src/integrations/**`
7. `supabase/functions/**`
8. `supabase/migrations/**`
