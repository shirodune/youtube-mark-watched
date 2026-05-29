import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/content.ts'],
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'chrome120',
  logLevel: 'info',
});
await copyFile('manifest.json', 'dist/manifest.json');
console.log('Build complete -> dist/');
