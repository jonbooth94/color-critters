// Regenerates the app icons in public/ from assets/icon.svg. Run: npm run icons
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = join(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'assets', 'icon.svg'));
const out = (name: string) => join(root, 'public', name);

for (const size of [192, 512]) {
  await sharp(svg, { density: (72 * size) / 1024 }).resize(size, size).png().toFile(out(`pwa-${size}.png`));
}
// The artwork keeps the cat inside the central safe zone, so it also works as a maskable icon.
await sharp(svg, { density: 36 }).resize(512, 512).png().toFile(out('maskable-512.png'));
copyFileSync(join(root, 'assets', 'icon.svg'), out('favicon.svg'));
console.log('Icons written to public/');
