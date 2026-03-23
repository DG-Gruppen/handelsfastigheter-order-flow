

## Fix sidebar jump when opening celebration comment dialog

### Problem
When opening the chat bubble dialog for "Veckans jubilarer", Radix Dialog's scroll-locking (`RemoveScroll`) applies inline styles to `<html>` and `<body>` that shift the page layout, causing the sidebar to jump. The existing CSS overrides in `index.css` aren't fully preventing this.

### Solution
Two changes to make the fix robust:

**1. `src/components/ui/dialog.tsx`** — Disable Radix's built-in scroll-locking by passing `modal={false}` to `DialogPrimitive.Content` and manually adding the overlay click-to-close behavior. This prevents `RemoveScroll` from injecting inline styles entirely.

Alternatively (simpler): Add `onOpenAutoFocus={(e) => e.preventDefault()}` to prevent focus-triggered scroll jumps, and keep `modal` mode but override the `DialogPrimitive.Content` with `data-vaul-no-drag`.

**Recommended approach**: The cleanest fix is to make `Dialog` pass through a `modal` prop and set `modal={false}` specifically in `CelebrationComments.tsx`. This avoids affecting all other dialogs in the app.

**2. `src/components/CelebrationComments.tsx`** — Pass `modal={false}` to the Dialog:
```tsx
<Dialog open={open} onOpenChange={onOpenChange} modal={false}>
```

This disables Radix's `RemoveScroll` wrapper for this specific dialog, preventing the sidebar jump while keeping the dialog functional with the existing overlay.

### Scope
- 1 file changed: `src/components/CelebrationComments.tsx` (1 line)
- No database changes

