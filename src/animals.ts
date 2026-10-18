import list from './animals/animals.json';

export interface AnimalEntry {
  id: string;
  name: string;
  file: string;
  /** Optional audio file path relative to src/animals/, e.g. "sounds/dog.mp3". */
  sound: string | null;
}

export interface Animal extends AnimalEntry {
  svgUrl: string;
  soundUrl: string | null;
}

// Every SVG and sound file is bundled as its own asset so the service worker precaches each one.
const svgUrls = import.meta.glob<string>('./animals/*.svg', { query: '?url', import: 'default', eager: true });
const soundUrls = import.meta.glob<string>('./animals/sounds/*.{mp3,ogg,wav,m4a}', {
  query: '?url',
  import: 'default',
  eager: true,
});

export const animals: Animal[] = (list as AnimalEntry[]).flatMap((entry) => {
  const svgUrl = svgUrls[`./animals/${entry.file}`];
  if (!svgUrl) return []; // the build validator catches this; skip rather than break the picker
  const soundUrl = entry.sound ? (soundUrls[`./animals/${entry.sound}`] ?? null) : null;
  return [{ ...entry, svgUrl, soundUrl }];
});
