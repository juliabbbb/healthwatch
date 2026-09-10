---
## HOTFIX A — Exclude @react-pdf/renderer from SSR (Nitro/TanStack Start)

### Standing Directive
HealthWatch frontend uses TanStack Start with Nitro for SSR. The `@react-pdf/renderer` package uses Node.js subpath imports (`#standard-fonts/Helvetica`) that break when bundled by Nitro for server-side execution. This causes repeated `[unhandledRejection] Error: Cannot find module '#standard-fonts/Helvetica'` on every SSR request.

### Fix

**Step 1 — Find the Vite / TanStack Start config.**
Look for `app.config.ts`, `vite.config.ts`, or `tanstack.config.ts` in the frontend root. This is where Nitro/Vite bundler options are set.

**Step 2 — Add SSR externals / noExternal exclusion.**
In the config, add `@react-pdf/renderer` and its sub-packages to the SSR `noExternal` or `external` list so Nitro does not attempt to bundle them server-side. The exact config depends on what file you find:

If using `app.config.ts` (TanStack Start):
```typescript
import { defineConfig } from '@tanstack/start/config';

export default defineConfig({
  server: {
    // Tell Nitro to not bundle these — leave them as external CJS requires
    externals: {
      external: [
        '@react-pdf/renderer',
        '@react-pdf/font',
        '@react-pdf/standard-fonts',
      ],
    },
  },
  vite: {
    ssr: {
      noExternal: [], // leave empty or remove @react-pdf from this list if it was here
      external: ['@react-pdf/renderer', '@react-pdf/font', '@react-pdf/standard-fonts'],
    },
  },
});
```

If using `vite.config.ts` directly:
```typescript
export default defineConfig({
  ssr: {
    external: ['@react-pdf/renderer', '@react-pdf/font', '@react-pdf/standard-fonts'],
  },
});
```

**Step 3 — Mark all PDF export components as client-only.**
Every component that imports from `@react-pdf/renderer` must be wrapped in a dynamic import with SSR disabled. In TanStack Start / React, do this:

```typescript
// Instead of:
import { PDFDownloadLink, Document, Page } from '@react-pdf/renderer';

// Do this at the top of any file that uses react-pdf:
import { lazy, Suspense } from 'react';

// Move ALL react-pdf usage into a separate component file, e.g. PdfExportButton.client.tsx
// Then import it like:
const PdfExportButton = lazy(() => import('./PdfExportButton.client'));

// Wrap usage in Suspense:
<Suspense fallback={<button disabled>Preparing PDF...</button>}>
  <PdfExportButton data={exportData} />
</Suspense>
```

In TanStack Start, you can also use the `clientOnly` helper if available:
```typescript
import { clientOnly } from '@tanstack/start';
const PdfExportButton = clientOnly(() => import('./PdfExportButton.client'));
```

**Step 4 — Verify the `.client.tsx` file.**
The `PdfExportButton.client.tsx` (or whatever you name it) must:
- Have ALL `@react-pdf/renderer` imports at the top.
- Export a single default component.
- Never be imported directly anywhere — always through the lazy/clientOnly wrapper.
- Include a `typeof window !== 'undefined'` guard if any logic runs outside the component body.

**Step 5 — Redeploy and confirm.**
After this change, the `[unhandledRejection] Error: Cannot find module '#standard-fonts/Helvetica'` errors must stop appearing in Render logs entirely.