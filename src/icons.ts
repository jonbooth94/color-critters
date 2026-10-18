// Inline SVG icons (no external files or fonts).

const S = 'xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#2b2b2b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"';

export const homeIcon = `<svg ${S} viewBox="0 0 100 100"><path d="M14 50 L50 18 L86 50" /><path d="M26 42 V84 H74 V42" fill="#ffd34d"/><path d="M43 84 V62 H57 V84" fill="#fff"/></svg>`;

export const clearIcon = `<svg ${S} viewBox="0 0 100 100"><path d="M18 62 L52 28 Q58 22 64 28 L82 46 Q88 52 82 58 L56 84 H34 L18 68 Q12 62 18 62 Z" fill="#ff8fbf"/><path d="M38 42 L68 72"/><path d="M56 84 H86"/></svg>`;

export const ringSvg = `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg>`;

export const soundOnIcon = `<svg ${S} stroke-width="8" viewBox="0 0 100 100"><path d="M18 40 H34 L54 22 V78 L34 60 H18 Z" fill="#2b2b2b"/><path d="M66 36 Q76 50 66 64"/><path d="M76 26 Q94 50 76 74"/></svg>`;

export const soundOffIcon = `<svg ${S} stroke-width="8" viewBox="0 0 100 100"><path d="M18 40 H34 L54 22 V78 L34 60 H18 Z" fill="#2b2b2b"/><path d="M68 38 L90 62 M90 38 L68 62"/></svg>`;

/** A horizontal crayon pointing left, filled with the given color. */
export function crayonIcon(color: string, light: boolean): string {
  const edge = light ? '#9a9a9a' : 'rgba(0,0,0,0.35)';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 64" aria-hidden="true">
    <path d="M6 32 L32 14 V50 Z" fill="${color}" stroke="${edge}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="30" y="10" width="94" height="44" rx="10" fill="${color}" stroke="${edge}" stroke-width="3"/>
    <rect x="52" y="10" width="54" height="44" fill="rgba(255,255,255,0.28)"/>
    <path d="M52 10 V54 M106 10 V54" stroke="${edge}" stroke-width="3"/>
  </svg>`;
}
