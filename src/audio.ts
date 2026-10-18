// All sound effects are synthesized with the Web Audio API; no audio files needed.

const MUTE_KEY = 'cc.muted';
let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // storage unavailable: mute still works for this session
  }
}

/** Create/resume the AudioContext. Must run inside a user gesture. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function ready(): AudioContext | null {
  if (muted || !ctx || ctx.state !== 'running') return null;
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, peak: number, type: OscillatorType = 'sine', endFreq?: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/** Soft pop for swatch taps. */
export function playPop(): void {
  const ac = ready();
  if (!ac) return;
  tone(ac, 620, ac.currentTime, 0.11, 0.22, 'sine', 240);
}

/** Gentle rising chime when an animal opens. */
export function playChime(): void {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [1046.5, 1318.5, 1568].forEach((f, i) => tone(ac, f, t + i * 0.09, 0.7, 0.09));
}

/** Soft whoosh when the drawing is cleared. */
export function playWhoosh(): void {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  const dur = 0.6;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(350, t);
  filter.frequency.exponentialRampToValueAtTime(2200, t + dur * 0.45);
  filter.frequency.exponentialRampToValueAtTime(500, t + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t);
  src.stop(t + dur);
}

/** Optional per-animal sound file (bundled from src/animals/sounds). */
export function playFile(url: string): void {
  if (muted) return;
  const audio = new Audio(url);
  audio.play().catch(() => undefined);
}
