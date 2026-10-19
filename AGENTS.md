# Project rules

- Knowledge-base mutations must confirm a returned row before displaying success and invalidate the shared knowledge-base query after persistence, so failed writes and stale lists cannot look like successful publication.
- Content-index trigger upserts must use (source_table, source_id, chunk_index), with chunk_index 0 for unchunked sources, because the index is unique per source chunk rather than per source.
- Knowledge-base deletes archive complete rows transactionally through database triggers; restoration is editor-only, checks expiry server-side and restores articles/videos as drafts to avoid accidental republication and notifications. Used categories cannot be deleted to preserve associations; expired archive rows are purged daily.