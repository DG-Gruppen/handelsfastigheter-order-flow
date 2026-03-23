INSERT INTO public.integration_status (slug, name, status, metadata)
VALUES ('google-drive', 'Google Drive (AI-indexering)', 'ok', '{"folders": 3, "awaiting_share": true}'::jsonb)
ON CONFLICT DO NOTHING;