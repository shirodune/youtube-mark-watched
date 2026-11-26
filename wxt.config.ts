import { defineConfig } from 'wxt';

// No permissions at all (SPEC.md §6): content-script fetches run as the page, under YouTube's CORS.
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'YouTube Mark as Watched',
  },
  // Don't launch a throwaway browser: load .output/chrome-mv3-dev once into your own
  // signed-in Chrome; `bun run dev` then auto-reloads the extension on every change.
  webExt: { disabled: true },
  // Fixed port: the loaded dev build only reconnects (and auto-reloads) on the port it was built for.
  dev: { server: { port: 3001 } },
  // Stable asset name so README can link to releases/latest/download/<name>.
  zip: { artifactTemplate: '{{name}}-{{browser}}.zip' },
});
