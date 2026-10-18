import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ROOT, UPDATE_DIRS, drawStroke, goHome, hex, isColor, openAnimal, pixelAt, selectColor, waitForServiceWorker, waitForStored } from './helpers.ts';
import { SwitchableServer } from './switchable-server.ts';

const GREEN = hex('#43a047');
const PURPLE = hex('#8e24aa');
const dirA = join(ROOT, UPDATE_DIRS['update-a']);
const dirB = join(ROOT, UPDATE_DIRS['update-b']);

const version = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.dataset.version).catch(() => 'navigating');

test('an update is applied only on the picker, never during coloring, and drawings survive', async ({ page }) => {
  // Sanity: version B really ships a changed asset.
  const jsA = readdirSync(join(dirA, 'assets')).filter((f) => f.endsWith('.js')).sort();
  const jsB = readdirSync(join(dirB, 'assets')).filter((f) => f.endsWith('.js')).sort();
  expect(jsA).not.toEqual(jsB);

  const server = new SwitchableServer();
  const url = await server.start(dirA);
  try {
    // --- Version A is installed and a drawing is made.
    await page.goto(url);
    await waitForServiceWorker(page);
    expect(await version(page)).toBe('update-a');

    await openAnimal(page, 'turtle');
    await selectColor(page, 'green');
    await drawStroke(page, [0.1, 0.3], [0.9, 0.3]);
    await waitForStored(page, 'turtle');
    await page.evaluate(() => ((window as unknown as { noReload: boolean }).noReload = true));

    // --- Version B is deployed and found while she is coloring.
    server.root = dirB;
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    await expect
      .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), { timeout: 20_000 })
      .toBe(true);

    // It must NOT reload during coloring.
    await page.waitForTimeout(2000);
    expect(await page.evaluate(() => (window as unknown as { noReload?: boolean }).noReload)).toBe(true);
    expect(await version(page)).toBe('update-a');
    await expect(page.locator('#coloring')).toBeVisible();
    // She keeps coloring normally.
    await selectColor(page, 'purple');
    await drawStroke(page, [0.1, 0.7], [0.9, 0.7]);

    // --- Going home saves the drawing, then the update is applied on the picker.
    await page.locator('#home').click();
    await expect.poll(() => version(page), { timeout: 20_000 }).toBe('update-b');
    expect(await page.evaluate(() => (window as unknown as { noReload?: boolean }).noReload)).toBeUndefined();
    await expect(page.locator('#picker')).toBeVisible();

    // --- Both strokes survived the update.
    await expect(page.locator('.tile[data-id="turtle"] .thumb-color')).toBeVisible();
    await openAnimal(page, 'turtle');
    expect(isColor(await pixelAt(page, 0.5, 0.3), GREEN)).toBe(true);
    expect(isColor(await pixelAt(page, 0.5, 0.7), PURPLE)).toBe(true);
    await goHome(page);
  } finally {
    await server.stop();
  }
});

test('a fresh launch applies a waiting update immediately', async ({ page }) => {
  const server = new SwitchableServer();
  const url = await server.start(dirA);
  try {
    await page.goto(url);
    await waitForServiceWorker(page);
    expect(await version(page)).toBe('update-a');
    server.root = dirB;
    // Relaunch: the app opens on the picker, finds B, and switches to it.
    await page.reload();
    await expect.poll(() => version(page), { timeout: 20_000 }).toBe('update-b');
    await expect(page.locator('#picker')).toBeVisible();
  } finally {
    await server.stop();
  }
});
