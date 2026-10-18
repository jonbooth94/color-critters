import type { Animal } from './animals';
import { clearDrawing, loadDrawing, saveDrawing } from './storage';
import { playChime, playFile, playPop, playWhoosh } from './audio';
import { clearIcon, crayonIcon, homeIcon, ringSvg } from './icons';

/** Fixed internal resolution: drawings are resolution-independent and saved at this size. */
export const CANVAS_SIZE = 1024;
const LINE_WIDTH = Math.round(CANVAS_SIZE * 0.04);
const SAVE_DEBOUNCE_MS = 500;
const CLEAR_HOLD_MS = 2000;

export const COLORS = [
  { name: 'red', value: '#e53935' },
  { name: 'orange', value: '#fb8c00' },
  { name: 'yellow', value: '#fdd835' },
  { name: 'green', value: '#43a047' },
  { name: 'blue', value: '#1e88e5' },
  { name: 'purple', value: '#8e24aa' },
  { name: 'pink', value: '#f48fb1' },
  { name: 'brown', value: '#795548' },
  { name: 'black', value: '#212121' },
  { name: 'white', value: '#ffffff' }, // also the eraser: the color layer starts white
] as const;

interface Point {
  x: number;
  y: number;
}

export class ColoringScreen {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly outline: HTMLImageElement;
  private readonly ring: SVGCircleElement;
  private readonly swatches: HTMLButtonElement[] = [];

  private animal: Animal | null = null;
  private ready = false;
  private color: string = COLORS[0].value;

  // Single-finger drawing: only the first active pointer draws.
  private activePointer: number | null = null;
  private rect: DOMRect | null = null;
  private last: Point = { x: 0, y: 0 };
  private lastMid: Point = { x: 0, y: 0 };

  // Saving
  private dirty = false;
  private saveTimer = 0;
  private pendingSaves = 0;
  private saveChain: Promise<void> = Promise.resolve();

  // Clear press-and-hold
  private holdPointer: number | null = null;
  private holdStart = 0;
  private holdFrame = 0;

  constructor(
    private readonly onHome: () => void,
    private readonly onLoadError: (animal: Animal) => void,
  ) {
    this.canvas = document.getElementById('paint') as HTMLCanvasElement;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not available');
    this.ctx = ctx;
    this.outline = document.getElementById('outline') as HTMLImageElement;

    const home = document.getElementById('home') as HTMLButtonElement;
    home.innerHTML = homeIcon;
    home.addEventListener('click', () => this.onHome());

    const clear = document.getElementById('clear') as HTMLButtonElement;
    clear.innerHTML = clearIcon + ringSvg;
    this.ring = clear.querySelector('.ring circle') as SVGCircleElement;
    this.setupClear(clear);

    this.setupPalette(document.getElementById('palette') as HTMLElement);
    this.setupDrawing();

    this.outline.addEventListener('error', () => {
      const failed = this.animal;
      if (failed) this.onLoadError(failed);
    });
  }

  get currentAnimal(): Animal | null {
    return this.animal;
  }

  /** True when there is nothing unsaved and no save in flight. */
  isSaved(): boolean {
    return !this.dirty && this.pendingSaves === 0;
  }

  async open(animal: Animal): Promise<void> {
    this.endStroke();
    this.animal = animal;
    this.ready = false;
    delete this.canvas.dataset.ready;
    this.dirty = false;
    this.fillWhite();
    this.outline.src = animal.svgUrl;

    let blob: Blob | undefined;
    try {
      blob = await loadDrawing(animal.id);
    } catch {
      blob = undefined; // storage unavailable: start blank
    }
    if (this.animal !== animal) return;
    if (blob) {
      try {
        const bitmap = await createImageBitmap(blob);
        if (this.animal !== animal) return;
        this.ctx.drawImage(bitmap, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        bitmap.close();
      } catch {
        // a corrupt image should never block coloring
      }
    }
    this.ready = true;
    this.canvas.dataset.ready = 'true'; // lets end-to-end tests know the saved drawing is restored
    playChime();
    if (animal.soundUrl) playFile(animal.soundUrl);
  }

  /** Leave the screen. The canvas is snapshotted immediately; the promise resolves once stored. */
  close(): Promise<void> {
    this.endStroke();
    this.cancelHold();
    const saved = this.flush();
    this.animal = null;
    this.ready = false;
    delete this.canvas.dataset.ready;
    return saved;
  }

  /** Save now if anything changed. Safe to call any time (visibilitychange, pagehide). */
  flush(): Promise<void> {
    clearTimeout(this.saveTimer);
    this.saveTimer = 0;
    if (!this.dirty || !this.animal) return this.saveChain;
    this.dirty = false;
    const id = this.animal.id;
    // toBlob copies the bitmap synchronously, so later strokes can't leak into this save.
    const blob = new Promise<Blob>((resolve, reject) =>
      this.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
    );
    this.pendingSaves++;
    this.saveChain = this.saveChain
      .then(async () => saveDrawing(id, await blob))
      .catch(() => undefined)
      .finally(() => {
        this.pendingSaves--;
      });
    return this.saveChain;
  }

  private scheduleSave(): void {
    this.dirty = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.flush(), SAVE_DEBOUNCE_MS);
  }

  private fillWhite(): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  // ---------- Palette ----------

  private setupPalette(palette: HTMLElement): void {
    for (const c of COLORS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.dataset.color = c.name;
      btn.setAttribute('aria-label', c.name);
      btn.setAttribute('aria-pressed', String(c.value === this.color));
      btn.innerHTML = crayonIcon(c.value, c.name === 'white' || c.name === 'yellow');
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.selectColor(c.value);
        playPop();
      });
      palette.append(btn);
      this.swatches.push(btn);
    }
  }

  private selectColor(value: string): void {
    this.color = value;
    COLORS.forEach((c, i) => this.swatches[i]?.setAttribute('aria-pressed', String(c.value === value)));
  }

  // ---------- Drawing ----------

  private setupDrawing(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e));
    c.addEventListener('lostpointercapture', (e) => this.onUp(e));
  }

  private toCanvas(e: PointerEvent): Point {
    const r = this.rect ?? this.canvas.getBoundingClientRect();
    const scale = CANVAS_SIZE / r.width;
    return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * scale };
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    if (!this.ready || this.activePointer !== null) return; // ignore extra fingers and palms
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.activePointer = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort
    }
    this.rect = this.canvas.getBoundingClientRect();
    const p = this.toCanvas(e);
    this.last = p;
    this.lastMid = p;

    const ctx = this.ctx;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // A single tap leaves a dot.
    ctx.beginPath();
    ctx.arc(p.x, p.y, LINE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer) return;
    e.preventDefault();
    const events = e.getCoalescedEvents?.() ?? [];
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(this.lastMid.x, this.lastMid.y);
    for (const ev of events.length ? events : [e]) {
      const p = this.toCanvas(ev);
      if (Math.abs(p.x - this.last.x) + Math.abs(p.y - this.last.y) < 1) continue;
      // Quadratic curve through midpoints gives smooth strokes from sparse points.
      const mid = { x: (this.last.x + p.x) / 2, y: (this.last.y + p.y) / 2 };
      ctx.quadraticCurveTo(this.last.x, this.last.y, mid.x, mid.y);
      this.last = p;
      this.lastMid = mid;
    }
    ctx.stroke();
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer) return;
    this.endStroke();
  }

  private endStroke(): void {
    if (this.activePointer === null) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(this.lastMid.x, this.lastMid.y);
    ctx.lineTo(this.last.x, this.last.y);
    ctx.stroke();
    try {
      if (this.canvas.hasPointerCapture(this.activePointer)) this.canvas.releasePointerCapture(this.activePointer);
    } catch {
      // already released
    }
    this.activePointer = null;
    this.rect = null;
    this.scheduleSave();
  }

  // ---------- Clear (press and hold) ----------

  private setupClear(btn: HTMLButtonElement): void {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.holdPointer !== null || !this.ready) return;
      this.holdPointer = e.pointerId;
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        // best-effort
      }
      this.holdStart = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - this.holdStart) / CLEAR_HOLD_MS, 1);
        this.ring.style.strokeDashoffset = String(100 * (1 - progress));
        if (progress >= 1) {
          this.cancelHold();
          this.clearDrawing();
        } else {
          this.holdFrame = requestAnimationFrame(tick);
        }
      };
      this.holdFrame = requestAnimationFrame(tick);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.holdPointer) this.cancelHold();
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
  }

  private cancelHold(): void {
    cancelAnimationFrame(this.holdFrame);
    this.holdPointer = null;
    this.ring.style.strokeDashoffset = '100';
  }

  private clearDrawing(): void {
    if (!this.animal) return;
    this.endStroke();
    this.fillWhite();
    clearTimeout(this.saveTimer);
    this.saveTimer = 0;
    this.dirty = false;
    const id = this.animal.id;
    this.pendingSaves++;
    this.saveChain = this.saveChain
      .then(() => clearDrawing(id))
      .catch(() => undefined)
      .finally(() => {
        this.pendingSaves--;
      });
    playWhoosh();
  }
}
