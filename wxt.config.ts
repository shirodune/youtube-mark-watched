import { defineConfig } from 'wxt';

// See SPEC.md §6 for why only the YouTube host permission is requested.
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'YouTube Mark as Watched',
    host_permissions: ['*://*.youtube.com/*'],
  },
  // Don't launch a throwaway browser: load .output/chrome-mv3-dev once into your own
  // signed-in Chrome; `bun run dev` then auto-reloads the extension on every change.
  webExt: { disabled: true },
});
