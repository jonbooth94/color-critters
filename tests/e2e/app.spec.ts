import { expect, test } from '@playwright/test';
import {
  WHITE,
  animalIds,
  canvasPoint,
  collectErrors,
  drawStroke,
  goHome,
  hex,
  isColor,
  openAnimal,
  pixelAt,
  selectColor,
  waitForServiceWorker,
  waitForStored,
} from './helpers.ts';

const RED = hex('#e53935');
const BLUE = hex('#1e88e5');

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.tile').first()).toBeVisible();
});

test('loads with zero console errors and the service worker takes control', async ({ page }) => {
  const errors = collectErrors(page);
  await page.reload();
  await waitForServiceWorker(page);
  await openAnimal(page, animalIds[0]!);
  await drawStroke(page, [0.2, 0.2], [0.5, 0.5]);
  await goHome(page);
  expect(errors).toEqual([]);
});

test('every animal renders on the picker and opens', async ({ page }) => {
  await expect(page.locator('.tile')).toHaveCount(animalIds.length);
  for (const id of animalIds) {
    const outline = page.locator(`.tile[data-id="${id}"] .thumb-outline`);
    await expect.poll(() => outline.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await openAnimal(page, id);
    await goHome(page);
  }
});

test('drawing changes canvas pixels and switching colors changes the stroke color', async ({ page }) => {
  await openAnimal(page, 'dog');
  expect(await pixelAt(page, 0.1, 0.1)).toEqual(WHITE);

  await selectColor(page, 'red');
  await drawStroke(page, [0.1, 0.1], [0.9, 0.1]);
  expect(isColor(await pixelAt(page, 0.5, 0.1), RED)).toBe(true);

  await selectColor(page, 'blue');
  await drawStroke(page, [0.1, 0.9], [0.9, 0.9]);
  expect(isColor(await pixelAt(page, 0.5, 0.9), BLUE)).toBe(true);
  expect(isColor(await pixelAt(page, 0.5, 0.1), RED)).toBe(true);

  // White paints over color (the eraser).
  await selectColor(page, 'white');
  await drawStroke(page, [0.1, 0.1], [0.9, 0.1]);
  expect(await pixelAt(page, 0.5, 0.1)).toEqual(WHITE);

  // A single tap leaves a dot.
  await selectColor(page, 'red');
  const p = await canvasPoint(page, 0.5, 0.5);
  await page.mouse.click(p.x, p.y);
  expect(isColor(await pixelAt(page, 0.5, 0.5), RED)).toBe(true);
});

test('a second simultaneous touch point is ignored', async ({ page }) => {
  await openAnimal(page, 'cat');
  await selectColor(page, 'red');
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: { x: number; y: number; id: number }[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints });

  const a1 = await canvasPoint(page, 0.1, 0.2);
  const a2 = await canvasPoint(page, 0.3, 0.2);
  const b1 = await canvasPoint(page, 0.6, 0.8);
  const b2 = await canvasPoint(page, 0.9, 0.8);

  await touch('touchStart', [{ ...a1, id: 1 }]);
  await touch('touchMove', [{ ...a2, id: 1 }]);
  // Second finger lands far away while the first is still down, then both move.
  await touch('touchStart', [{ ...a2, id: 1 }, { ...b1, id: 2 }]);
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    await touch('touchMove', [
      { x: a2.x, y: a2.y + t * 20, id: 1 },
      { x: b1.x + (b2.x - b1.x) * t, y: b1.y, id: 2 },
    ]);
  }
  await touch('touchEnd', []);

  // The first finger drew.
  expect(isColor(await pixelAt(page, 0.2, 0.2), RED)).toBe(true);
  // The second finger drew nothing, and no line joins the two fingers.
  for (const [x, y] of [[0.6, 0.8], [0.75, 0.8], [0.9, 0.8], [0.45, 0.5], [0.6, 0.65]] as const) {
    expect(await pixelAt(page, x, y)).toEqual(WHITE);
  }
  // Pinching didn't zoom the page.
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
  await expect(page.locator('#coloring')).toBeVisible();
});

test('clear does nothing on a short press and clears after a 2-second hold', async ({ page }) => {
  await openAnimal(page, 'duck');
  await drawStroke(page, [0.2, 0.5], [0.8, 0.5]);
  await waitForStored(page, 'duck');
  const clear = page.locator('#clear');
  const box = (await clear.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await page.waitForTimeout(1500); // longer than the remaining hold time: must not fire after release
  expect(await pixelAt(page, 0.5, 0.5)).not.toEqual(WHITE);

  await page.mouse.down();
  await page.waitForTimeout(800);
  // The ring is visibly filling while held.
  const offset = await page.locator('#clear .ring circle').evaluate((c) => parseFloat((c as SVGElement).style.strokeDashoffset));
  expect(offset).toBeLessThan(100);
  await page.waitForTimeout(1500);
  await page.mouse.up();
  expect(await pixelAt(page, 0.5, 0.5)).toEqual(WHITE);
  await waitForStored(page, 'duck', false);
});

test('a drawing persists after reload and after returning to the picker', async ({ page }) => {
  await openAnimal(page, 'lion');
  await selectColor(page, 'blue');
  await drawStroke(page, [0.1, 0.5], [0.9, 0.5]);
  await waitForStored(page, 'lion');

  await goHome(page);
  const thumb = page.locator('.tile[data-id="lion"] .thumb-color');
  await expect(thumb).toBeVisible();
  await openAnimal(page, 'lion');
  expect(isColor(await pixelAt(page, 0.5, 0.5), BLUE)).toBe(true);

  await page.reload();
  await expect(page.locator('.tile[data-id="lion"] .thumb-color')).toBeVisible();
  await openAnimal(page, 'lion');
  expect(isColor(await pixelAt(page, 0.5, 0.5), BLUE)).toBe(true);
});

test('drawing is saved when the app is hidden', async ({ page }) => {
  await openAnimal(page, 'cow');
  await drawStroke(page, [0.1, 0.5], [0.9, 0.5]);
  // Simulate the app going to the background before the 500ms debounce fires.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitForStored(page, 'cow');
});

test('works offline: reload and open every animal', async ({ page, context }) => {
  await waitForServiceWorker(page);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('.tile')).toHaveCount(animalIds.length);
    for (const id of animalIds) {
      await openAnimal(page, id);
      await goHome(page);
    }
  } finally {
    await context.setOffline(false);
  }
});

test('manifest is valid and the app is installable', async ({ page }) => {
  await waitForServiceWorker(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await page.request.get(new URL(href!, page.url()).href);
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    name: 'Color Critters',
    short_name: 'Color Critters',
    display: 'fullscreen',
    orientation: 'landscape',
    start_url: '/color-critters/',
  });
  const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}:${i.purpose ?? 'any'}`);
  expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
  for (const icon of manifest.icons as { src: string }[]) {
    const iconRes = await page.request.get(new URL(icon.src, res.url()).href);
    expect(iconRes.ok()).toBe(true);
    expect(iconRes.headers()['content-type']).toContain('image/png');
  }

  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});

test('makes no requests to other hosts', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && !['blob:', 'data:'].includes(url.protocol)) external.push(req.url());
  });
  await page.reload();
  await openAnimal(page, 'fish');
  await drawStroke(page, [0.2, 0.2], [0.6, 0.6]);
  await goHome(page);
  expect(external).toEqual([]);
});
