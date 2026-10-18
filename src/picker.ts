import type { Animal } from './animals';
import { loadDrawing } from './storage';

interface Tile {
  el: HTMLButtonElement;
  color: HTMLImageElement;
  objectUrl: string | null;
}

export class Picker {
  private readonly tiles = new Map<string, Tile>();

  constructor(
    grid: HTMLElement,
    animals: Animal[],
    private readonly onOpen: (animal: Animal) => void,
  ) {
    for (const animal of animals) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tile';
      el.dataset.id = animal.id;
      el.setAttribute('aria-label', animal.name);

      const color = document.createElement('img');
      color.className = 'thumb-color';
      color.alt = '';
      color.draggable = false;
      color.hidden = true;

      const outline = document.createElement('img');
      outline.className = 'thumb-outline';
      outline.alt = '';
      outline.draggable = false;
      // If an animal's art fails to load, hide just that tile.
      outline.addEventListener('error', () => this.hide(animal.id));
      outline.src = animal.svgUrl;

      el.append(color, outline);
      el.addEventListener('click', () => {
        if (this.tiles.has(animal.id)) this.onOpen(animal);
      });
      grid.append(el);
      const tile: Tile = { el, color, objectUrl: null };
      this.tiles.set(animal.id, tile);
      void this.refresh(animal.id);
    }
  }

  hide(id: string): void {
    const tile = this.tiles.get(id);
    if (!tile) return;
    tile.el.remove();
    if (tile.objectUrl) URL.revokeObjectURL(tile.objectUrl);
    this.tiles.delete(id);
  }

  /** Reload one thumbnail's saved coloring from storage. */
  async refresh(id: string): Promise<void> {
    const tile = this.tiles.get(id);
    if (!tile) return;
    let blob: Blob | undefined;
    try {
      blob = await loadDrawing(id);
    } catch {
      blob = undefined;
    }
    if (tile.objectUrl) URL.revokeObjectURL(tile.objectUrl);
    tile.objectUrl = blob ? URL.createObjectURL(blob) : null;
    if (tile.objectUrl) tile.color.src = tile.objectUrl;
    else tile.color.removeAttribute('src');
    tile.color.hidden = !blob;
  }

  refreshAll(): void {
    for (const id of this.tiles.keys()) void this.refresh(id);
  }
}
