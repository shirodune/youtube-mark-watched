import { build } from 'esbuild';
import { copyFile, mkdir, cp } from 'node:fs/promises';

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
await cp('icons', 'dist/icons', { recursive: true });
console.log('Build complete -> dist/');
