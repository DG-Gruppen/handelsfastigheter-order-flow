# Project rules

- Knowledge-base mutations must confirm a returned row before displaying success and invalidate the shared knowledge-base query after persistence, so failed writes and stale lists cannot look like successful publication.