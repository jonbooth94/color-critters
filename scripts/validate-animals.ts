// Fails the build if src/animals has a problem. Run: npm run validate
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateAnimals } from './animal-validation.ts';

const dir = join(import.meta.dirname, '..', 'src', 'animals');
const read = (p: string) => {
  const full = join(dir, p);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
};

const list = read('animals.json');
const errors = list === null ? ['src/animals/animals.json not found'] : validateAnimals(list, { read });

if (errors.length) {
  console.error('Animal validation failed:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`Animal validation passed (${(JSON.parse(list!) as unknown[]).length} animals).`);
