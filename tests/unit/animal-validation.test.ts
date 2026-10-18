import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateAnimals, validateSvg } from '../../scripts/animal-validation.ts';

const GOOD_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none" stroke="#000" stroke-width="16"><circle cx="512" cy="512" r="300"/></svg>';

function files(map: Record<string, string>) {
  return { read: (p: string) => map[p] ?? null };
}

const entry = (id: string, file = `${id}.svg`, sound: string | null = null) => ({ id, name: id, file, sound });

describe('animal list validation', () => {
  it('accepts a valid list', () => {
    const list = JSON.stringify([entry('dog'), entry('cat')]);
    expect(validateAnimals(list, files({ 'dog.svg': GOOD_SVG, 'cat.svg': GOOD_SVG }))).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    const list = JSON.stringify([entry('dog'), entry('dog', 'dog2.svg')]);
    const errors = validateAnimals(list, files({ 'dog.svg': GOOD_SVG, 'dog2.svg': GOOD_SVG }));
    expect(errors.join('\n')).toMatch(/duplicate id "dog"/);
  });

  it('rejects a missing SVG file', () => {
    const errors = validateAnimals(JSON.stringify([entry('dog')]), files({}));
    expect(errors.join('\n')).toMatch(/"dog.svg" not found/);
  });

  it('rejects a missing sound file', () => {
    const list = JSON.stringify([entry('dog', 'dog.svg', 'sounds/dog.mp3')]);
    const errors = validateAnimals(list, files({ 'dog.svg': GOOD_SVG }));
    expect(errors.join('\n')).toMatch(/sound file "sounds\/dog.mp3" not found/);
  });

  it('rejects bad ids, missing names and invalid JSON', () => {
    expect(validateAnimals('[{"id":"Dog!","name":"","file":"a.svg","sound":null}]', files({ 'a.svg': GOOD_SVG })).length).toBe(2);
    expect(validateAnimals('not json', files({}))[0]).toMatch(/not valid JSON/);
  });

  it('passes for the real animals in src/animals', () => {
    const dir = join(import.meta.dirname, '..', '..', 'src', 'animals');
    const read = (p: string) => (existsSync(join(dir, p)) ? readFileSync(join(dir, p), 'utf8') : null);
    expect(validateAnimals(read('animals.json')!, { read })).toEqual([]);
  });
});

describe('SVG validation', () => {
  it('requires a 1024x1024 viewBox', () => {
    const svg = GOOD_SVG.replace('0 0 1024 1024', '0 0 512 512');
    expect(validateSvg(svg).join()).toMatch(/viewBox/);
  });

  it('rejects filled shapes', () => {
    const svg = GOOD_SVG.replace('<circle', '<circle fill="#f00"');
    expect(validateSvg(svg).join()).toMatch(/fill "#f00"/);
  });

  it('rejects shapes that fall back to the default black fill', () => {
    const svg = '<svg viewBox="0 0 1024 1024" stroke="#000"><path d="M0 0 L10 10"/></svg>';
    expect(validateSvg(svg).join()).toMatch(/fill "black"/);
  });

  it('rejects fills set through style or a parent group', () => {
    expect(validateSvg(GOOD_SVG.replace('<circle', '<circle style="fill: blue"')).length).toBe(1);
    const grouped = '<svg viewBox="0 0 1024 1024" fill="none"><g fill="red"><path d="M0 0"/></g></svg>';
    expect(validateSvg(grouped).join()).toMatch(/fill "red"/);
  });

  it('rejects a background rectangle or background style', () => {
    const rect = GOOD_SVG.replace('<circle', '<rect width="1024" height="1024" fill="white"/><circle');
    expect(validateSvg(rect).join()).toMatch(/<rect> has fill "white"/);
    const styled = GOOD_SVG.replace('<svg ', '<svg style="background: #fff" ');
    expect(validateSvg(styled).join()).toMatch(/background/);
  });

  it('rejects embedded images and style sheets', () => {
    expect(validateSvg(GOOD_SVG.replace('<circle', '<image href="x.png"/><circle')).join()).toMatch(/<image>/);
    expect(validateSvg(GOOD_SVG.replace('<circle', '<style>circle{fill:red}</style><circle')).join()).toMatch(/<style>/);
  });

  it('allows fill="none" on each shape without a root fill', () => {
    const svg = '<svg viewBox="0 0 1024 1024"><path fill="none" stroke="#000" d="M0 0"/></svg>';
    expect(validateSvg(svg)).toEqual([]);
  });
});
