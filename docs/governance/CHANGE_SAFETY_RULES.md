## Metadata
- Repository: DG-Gruppen/handelsfastigheter-order-flow
- Last Reviewed: 2026-03-21

## Safe Change Rules
- Prefer local guards before structural rewrites.
- Do not merge permission systems during a bugfix unless necessary.
- Do not treat UI lockout as a complete security fix.
- When changing order transitions, verify side effects and rollback behavior.
