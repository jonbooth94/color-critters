import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

export const ROOT = join(import.meta.dirname, '..', '..');
export const UPDATE_DIRS = { 'update-a': 'dist-update-a', 'update-b': 'dist-update-b' } as const;

export const animalIds: string[] = (
  JSON.parse(readFileSync(join(ROOT, 'src', 'animals', 'animals.json'), 'utf8')) as { id: string }[]
).map((a) => a.id);

export type RGB = [number, number, number];
export const WHITE: RGB = [255, 255, 255];

/** Collects console errors and uncaught page errors. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 });
}

export async function openAnimal(page: Page, id: string): Promise<void> {
  await page.locator(`.tile[data-id="${id}"]`).click();
  await expect(page.locator('#coloring')).toBeVisible();
  await expect(page.locator('#paint[data-ready="true"]')).toBeAttached();
  await expect.poll(() => page.locator('#outline').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
}

export async function goHome(page: Page): Promise<void> {
  await page.locator('#home').click();
  await expect(page.locator('#picker')).toBeVisible();
}

/** Page coordinates for a point given as a fraction (0..1) of the canvas. */
export async function canvasPoint(page: Page, fx: number, fy: number): Promise<{ x: number; y: number }> {
  const box = await page.locator('#paint').boundingBox();
  if (!box) throw new Error('canvas not visible');
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

/** Draws a stroke with the mouse between two canvas fractions. */
export async function drawStroke(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const a = await canvasPoint(page, ...from);
  const b = await canvasPoint(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}

/** Reads a pixel from the 1024x1024 color layer at a canvas fraction. */
export async function pixelAt(page: Page, fx: number, fy: number): Promise<RGB> {
  return page.locator('#paint').evaluate(
    (c: HTMLCanvasElement, [x, y]) => {
      const d = c.getContext('2d')!.getImageData(Math.round(x * 1024), Math.round(y * 1024), 1, 1).data;
      return [d[0], d[1], d[2]] as [number, number, number];
    },
    [fx, fy] as const,
  );
}

export async function selectColor(page: Page, name: string): Promise<void> {
  await page.locator(`.swatch[data-color="${name}"]`).click();
  await expect(page.locator(`.swatch[data-color="${name}"]`)).toHaveAttribute('aria-pressed', 'true');
}

/** Waits until the drawing for an animal is stored in IndexedDB (or removed, if expectSaved=false). */
export async function waitForStored(page: Page, id: string, expectSaved = true): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          (animalId) =>
            new Promise<boolean>((resolve) => {
              const req = indexedDB.open('color-critters');
              req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('drawings')) {
                  db.close();
                  resolve(false);
                  return;
                }
                const get = db.transaction('drawings').objectStore('drawings').get(animalId);
                get.onsuccess = () => {
                  resolve(get.result !== undefined);
                  db.close();
                };
                get.onerror = () => resolve(false);
              };
              req.onerror = () => resolve(false);
            }),
          id,
        ),
      { timeout: 10_000 },
    )
    .toBe(expectSaved);
}

export function isColor(px: RGB, expected: RGB, tolerance = 12): boolean {
  return px.every((v, i) => Math.abs(v - expected[i]!) <= tolerance);
}

export const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
