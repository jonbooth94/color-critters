// Validation rules for src/animals. Used by the build (scripts/validate-animals.ts)
// and by the unit tests. Plain TypeScript (no enums/namespaces) so Node can run it directly.

export interface FileReader {
  /** Returns file contents (relative to src/animals), or null if the file doesn't exist. */
  read(path: string): string | null;
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'use']);
const FORBIDDEN = new Set(['image', 'foreignobject', 'style', 'script', 'pattern']);
const NO_FILL = new Set(['none', 'transparent']);

export function validateAnimals(listJson: string, files: FileReader): string[] {
  const errors: string[] = [];
  let list: unknown;
  try {
    list = JSON.parse(listJson);
  } catch (e) {
    return [`animals.json is not valid JSON: ${(e as Error).message}`];
  }
  if (!Array.isArray(list)) return ['animals.json must be a list'];
  if (list.length === 0) errors.push('animals.json is empty');

  const seen = new Set<string>();
  list.forEach((raw: unknown, i) => {
    const where = `animals.json entry ${i + 1}`;
    if (typeof raw !== 'object' || raw === null) {
      errors.push(`${where}: must be an object`);
      return;
    }
    const entry = raw as Record<string, unknown>;
    const { id, name, file, sound } = entry;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
      errors.push(`${where}: "id" must be lowercase letters, numbers and dashes (got ${JSON.stringify(id)})`);
    } else if (seen.has(id)) {
      errors.push(`${where}: duplicate id "${id}"`);
    } else {
      seen.add(id);
    }
    if (typeof name !== 'string' || !name.trim()) errors.push(`${where}: "name" is required`);
    if (sound !== null && typeof sound !== 'string') errors.push(`${where}: "sound" must be null or a path`);
    if (typeof sound === 'string' && files.read(sound) === null) {
      errors.push(`${where}: sound file "${sound}" not found in src/animals`);
    }
    if (typeof file !== 'string' || !file.endsWith('.svg')) {
      errors.push(`${where}: "file" must be an .svg file name`);
      return;
    }
    const svg = files.read(file);
    if (svg === null) {
      errors.push(`${where}: file "${file}" not found in src/animals`);
      return;
    }
    for (const problem of validateSvg(svg)) errors.push(`${file}: ${problem}`);
  });
  return errors;
}

interface Tag {
  name: string;
  attrs: Record<string, string>;
  closing: boolean;
  selfClosing: boolean;
}

function parseTags(svg: string): Tag[] {
  const cleaned = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  const tags: Tag[] = [];
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const attrRe = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const m of cleaned.matchAll(tagRe)) {
    const attrs: Record<string, string> = {};
    for (const a of (m[3] ?? '').matchAll(attrRe)) attrs[(a[1] ?? '').toLowerCase()] = a[2] ?? a[3] ?? '';
    tags.push({ name: (m[2] ?? '').toLowerCase(), attrs, closing: m[1] === '/', selfClosing: m[4] === '/' });
  }
  return tags;
}

function styleProp(style: string | undefined, prop: string): string | undefined {
  if (!style) return undefined;
  for (const decl of style.split(';')) {
    const [k, ...v] = decl.split(':');
    if (k?.trim().toLowerCase() === prop) return v.join(':').trim().toLowerCase();
  }
  return undefined;
}

function fillOf(attrs: Record<string, string>): string | undefined {
  return styleProp(attrs.style, 'fill') ?? attrs.fill?.trim().toLowerCase();
}

export function validateSvg(svg: string): string[] {
  const errors: string[] = [];
  const tags = parseTags(svg);
  const root = tags[0];
  if (!root || root.name !== 'svg' || root.closing) return ['not an SVG file'];

  const viewBox = (root.attrs.viewbox ?? '').trim().split(/[\s,]+/).map(Number);
  if (viewBox.length !== 4 || viewBox.join(' ') !== '0 0 1024 1024') {
    errors.push(`viewBox must be "0 0 1024 1024" (got "${root.attrs.viewbox ?? ''}")`);
  }

  // Walk the tree, tracking inherited fill (SVG's default fill is black).
  const stack: string[] = [];
  let inherited = 'black';
  const filled = new Set<string>();
  for (const tag of tags) {
    if (tag.closing) {
      inherited = stack.pop() ?? 'black';
      continue;
    }
    if (FORBIDDEN.has(tag.name)) errors.push(`<${tag.name}> is not allowed`);
    const bg = styleProp(tag.attrs.style, 'background') ?? styleProp(tag.attrs.style, 'background-color');
    if (bg && bg !== 'none' && bg !== 'transparent') errors.push(`<${tag.name}> sets a background; it must be transparent`);
    const fill = fillOf(tag.attrs) ?? inherited;
    if (SHAPES.has(tag.name) && !NO_FILL.has(fill)) filled.add(`<${tag.name}> has fill "${fill}"`);
    if (!tag.selfClosing) {
      stack.push(inherited);
      inherited = fill;
    }
  }
  for (const f of filled) errors.push(`${f}; shapes must be outlines only (fill="none")`);
  return errors;
}
