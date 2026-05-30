// Zips the built dist/ folder into an uploadable Chrome Web Store package.
// Run after `npm run build` (the `package` npm script does both).
import { execSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';

if (!existsSync('dist/manifest.json')) {
  console.error('dist/ not built — run `npm run build` first.');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const out = `youtube-mark-watched-v${version}.zip`;
if (existsSync(out)) rmSync(out);

if (process.platform === 'win32') {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path 'dist/*' -DestinationPath '${out}' -Force"`,
    { stdio: 'inherit' },
  );
} else {
  execSync(`cd dist && zip -r -q "../${out}" . && cd ..`, { stdio: 'inherit' });
}

console.log(`Packaged -> ${out}`);
