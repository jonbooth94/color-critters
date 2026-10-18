// Dev-only art review page. Not part of the production build.
import animals from '../src/animals/animals.json';
import iconUrl from '../assets/icon.svg?url';

const svgUrls = import.meta.glob<string>('../src/animals/*.svg', { query: '?url', import: 'default', eager: true });

const icons = document.getElementById('icons')!;
for (const [size, cls, label] of [[48, 'square', '48px'], [64, 'square', '64px'], [64, 'round', '64px round'], [192, 'square', '192px']] as const) {
  icons.insertAdjacentHTML('beforeend', `<div><img class="${cls}" src="${iconUrl}" width="${size}" height="${size}" alt="">${label}</div>`);
}

const grid = document.getElementById('grid')!;
for (const a of animals) {
  const url = svgUrls[`../src/animals/${a.file}`];
  grid.insertAdjacentHTML('beforeend', `<figure><img src="${url}" alt=""><figcaption>${a.name}</figcaption></figure>`);
}
