// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const POK_STUB = path.resolve("./src/stubs/pok-payments-stub.js");

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: {
      entry: "server",
      // Force these packages to be bundled inline by Rollup instead of copied to _libs/
      // as raw ESM files — they use CJS interop helpers (__exportAll etc.) that aren't
      // available in the native ESM Cloudflare Workers context.
      externals: {
        inline: [
          "drizzle-orm",
          "@neondatabase/serverless",
          "drizzle-orm/neon-http",
        ],
      },
    },
  },
  vite: {
    plugins: [
      {
        // POK payments SDK uses node:http which CF Workers doesn't support.
        // During SSR/Nitro builds, redirect all POK SDK imports to an empty stub.
        // The real SDK is dynamically imported client-side only and works fine in the browser.
        name: "pok-ssr-stub",
        enforce: "pre" as const,
        resolveId(id: string, _importer: string | undefined, options: { ssr?: boolean } | undefined) {
          if (options?.ssr && id.startsWith("@nebula-ltd/pok-payments-js")) {
            return POK_STUB;
          }
        },
      },
    ],
  },
});
