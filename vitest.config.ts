import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest: same aliases/auto-imports as the build, plus a fake `browser`.
export default defineConfig({
  plugins: [WxtVitest()],
});
