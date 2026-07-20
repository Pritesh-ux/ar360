HYDRATION / CHUNK CACHE FIX

Fixed in code:
1. Master Admin Bandwidth now uses a fixed en-US number formatter on server and client.
   This prevents 243,220 vs 2,43,220 hydration mismatches.
2. QR Center's Created On timestamp now renders a stable placeholder during SSR
   and is populated after the component mounts.

After replacing the project, run these commands in PowerShell:

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run dev

Then hard refresh the browser with Ctrl+Shift+R.

Notes:
- The middleware deprecation message is a Next.js warning, not the hydration crash.
- The Lit dev-mode and requestAnimationFrame messages are development warnings from
  the model-viewer web component and are not the source of this hydration mismatch.
- The ChunkLoadError is normally stale Turbopack/.next cache and is cleared by deleting .next.
