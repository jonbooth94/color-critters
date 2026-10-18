import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { DB_NAME, DB_VERSION, clearDrawing, closeDb, loadDrawing, saveDrawing } from '../../src/storage.ts';

const png = (text: string) => new Blob([text], { type: 'image/png' });

describe('drawing storage', () => {
  beforeEach(() => {
    closeDb();
    globalThis.indexedDB = new IDBFactory(); // fresh database per test
  });

  it('returns nothing for an animal that was never colored', async () => {
    expect(await loadDrawing('dog')).toBeUndefined();
  });

  it('saves and loads a drawing by animal id', async () => {
    await saveDrawing('dog', png('dog-pixels'));
    const loaded = await loadDrawing('dog');
    expect(loaded?.type).toBe('image/png');
    expect(await loaded?.text()).toBe('dog-pixels');
  });

  it('overwrites the previous save and keeps animals separate', async () => {
    await saveDrawing('dog', png('v1'));
    await saveDrawing('cat', png('cat'));
    await saveDrawing('dog', png('v2'));
    expect(await (await loadDrawing('dog'))?.text()).toBe('v2');
    expect(await (await loadDrawing('cat'))?.text()).toBe('cat');
  });

  it('clears one drawing without touching others', async () => {
    await saveDrawing('dog', png('dog'));
    await saveDrawing('cat', png('cat'));
    await clearDrawing('dog');
    expect(await loadDrawing('dog')).toBeUndefined();
    expect(await (await loadDrawing('cat'))?.text()).toBe('cat');
  });

  it('keeps drawings across a reconnect (app restart)', async () => {
    await saveDrawing('duck', png('quack'));
    closeDb();
    expect(await (await loadDrawing('duck'))?.text()).toBe('quack');
  });

  it('uses a versioned schema', async () => {
    await saveDrawing('dog', png('x'));
    closeDb();
    const version = await new Promise<number>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => {
        resolve(req.result.version);
        req.result.close();
      };
      req.onerror = () => reject(req.error);
    });
    expect(version).toBe(DB_VERSION);
    expect(DB_VERSION).toBeGreaterThanOrEqual(1);
  });
});
