// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Target a standard Node HTTP server instead of the Lovable-default Cloudflare
  // Worker, so the built app can run on any Node host (Render, Railway, VPS...).
  nitro: {
    preset: "node-server",
  },
  vite: {
    ssr: {
      // @react-pdf/renderer uses Node.js subpath imports (#standard-fonts/Helvetica)
      // that break when Nitro bundles them for SSR. Externalise the entire package
      // tree so Nitro leaves them as runtime requires instead.
      external: [
        "@react-pdf/renderer",
        "@react-pdf/font",
        "@react-pdf/standard-fonts",
      ],
    },
  },
});
