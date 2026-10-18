import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { UPDATE_DIRS } from './helpers.ts';

const root = join(import.meta.dirname, '..', '..');

// The main suite tests dist/ (the real build). The update-survival test needs two
// distinct builds, version A and version B, so build those into their own folders.
export default function globalSetup(): void {
  if (!existsSync(join(root, 'dist', 'sw.js'))) {
    throw new Error('dist/ is missing. Run `npm run build` before the end-to-end tests.');
  }
  for (const [version, dir] of Object.entries(UPDATE_DIRS)) {
    execSync(`npx vite build --outDir ${dir} --emptyOutDir --logLevel error`, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, APP_VERSION: version },
    });
  }
}
