# Color Critters

A simple coloring app for a toddler. Pick an animal, color it with big crayons, and it saves automatically. It works fully offline once installed and makes no network requests while in use.

**Live app:** https://jonbooth94.github.io/color-critters/

---

## Install on an Android phone or tablet

1. Make sure the device is online.
2. Open **Chrome** and go to https://jonbooth94.github.io/color-critters/
3. Wait until you see the animal pictures (a couple of seconds). That's when it downloads everything it needs for offline use.
4. Tap Chrome's **⋮** menu (top-right).
5. Tap **Install app**. On some phones it says **Add to Home screen**, then **Install**.
6. Confirm. A yellow cat icon called **Color Critters** appears on the home screen.
7. Open it once from the home screen while still online. From then on it works in airplane mode.

The app opens full screen in landscape.

## Lock her into the app (Android screen pinning)

Screen pinning keeps the device on one app until you unpin it.

**Turn it on (one time per device).** Menu names vary a bit by brand:

- **Pixel / most Android:** Settings → **Security & privacy** → **More security & privacy** → **App pinning** → turn on. Also turn on **Ask for PIN before unpinning** (it may say "Lock device when unpinning").
- **Samsung Galaxy:** Settings → **Security and privacy** → **More security settings** → **Pin app** → turn on. Also turn on **Ask for PIN before unpinning**.
- Can't find it? Open Settings and search for **pin**.

**Pin the app:**

1. Open Color Critters.
2. Open the **Recents** screen. With gesture navigation, swipe up from the bottom and hold. With buttons, tap the square (or ||| ) button.
3. Tap the **app icon** at the top of the Color Critters card (on some phones, tap ⋮ on the card).
4. Tap **Pin** (or **Pin this app**).

**Unpin:**

- **Gesture navigation:** swipe up from the bottom and hold.
- **Button navigation:** touch and hold **Back** and **Recents** at the same time.
- Then enter your PIN if you turned that on.

## How updates reach the devices

- Every push to `main` runs the tests on GitHub. **The new version is published only if every test passes.**
- The app checks for a new version each time it's launched and every hour while it's open (only when online).
- New versions download quietly in the background. The update is applied only when the app is freshly opened, or when she's on the animal picker and her drawing is already saved. **It never reloads while she's coloring.** There are no pop-ups.
- Drawings are kept on the device (in the browser's storage, keyed by animal) and survive updates and restarts.
- To speed up an update on a device: open the app while online, go back to the animal picker, then close and reopen the app.

> Drawings are stored per device. Uninstalling the app or clearing Chrome's site data for the app deletes them.

## Add a new animal

Adding an animal takes only three things: an SVG file, one line in `animals.json`, and a push.

### 1. Make the art (rules)

The build **fails** if the art breaks any of the first three rules below, so you can't publish a broken animal by mistake.

| Rule | Detail |
|---|---|
| Canvas | `viewBox="0 0 1024 1024"` exactly |
| Outlines only | `stroke="#000"`, `fill="none"` on every shape (put it on the root `<svg>`) |
| Transparent background | no background rectangle, no background style, no embedded images |
| Line style | `stroke-width` 14–18 (the others use 16), `stroke-linecap="round"`, `stroke-linejoin="round"` |
| Look | cute and simple for a toddler: big shapes, big eyes, very few small details, no text |
| Layout | centered with about 8% empty space around the edge (keep drawing inside roughly 82 to 942) |

Start your file from this skeleton:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none" stroke="#000" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
  <!-- shapes go here -->
</svg>
```

Solid black pupils are made from strokes, not fills: a tiny dot `<path d="M500 400 m-1 0 h2"/>` plus a ring `<circle cx="500" cy="400" r="15"/>`. Copy them from `src/animals/dog.svg`.

### 2. Add the files

1. Save the SVG as `src/animals/<id>.svg`, e.g. `src/animals/pig.svg`. Use lowercase letters, numbers and dashes only.
2. Add one line to `src/animals/animals.json`, in the position where it should appear on the picker:
   ```json
   { "id": "pig", "name": "Pig", "file": "pig.svg", "sound": null },
   ```
   Every line except the last ends with a comma. The `id` must be unique; it's what drawings are saved under, so **never change an existing animal's id** or her saved coloring of it will disappear. You *can* replace an animal's SVG at any time; her drawing stays.
3. Optional sound: put an audio file (`.mp3`, `.ogg`, `.wav` or `.m4a`) in `src/animals/sounds/` and set `"sound": "sounds/pig.mp3"`. It plays when that animal opens.

### 3. Publish

**From your computer** (in this folder):

```bash
git add -A
```
```bash
git commit -m "Add pig"
```
```bash
git push
```

**Or entirely on GitHub.com:** open the repo, go to `src/animals`, use **Add file → Upload files** for the SVG, then open `animals.json`, click the pencil icon, add the line, and **Commit changes**.

Then check the **Actions** tab on GitHub. A green check means it's live. A red X means a test or the art check failed; click into it to see why. The devices pick up the new animal automatically (see "How updates reach the devices").

## Ask Claude Code to redo or add an animal

Open Claude Code in this folder and ask in plain words. Examples:

- *"Add a pig to Color Critters, following the art spec in the README. Put it after the cow. Show me the art review page before you push."*
- *"Redo the elephant: make the ear bigger and the trunk curl up at the end. Keep the same style as the other animals."*
- *"The prairie dog looks like a bear. Make it more recognizable: thinner, taller, with its paws held together under its chin."*

Ask it to show you the **art review page** (`npm run dev`, then open http://localhost:5173/color-critters/dev/review.html) before it pushes. That page shows every animal large with its name, plus the app icon. It is never part of the live app.

## Run the tests locally

One-time setup:

```bash
npm ci
```
```bash
npx playwright install chromium
```

Then:

```bash
npm run typecheck
```
```bash
npm run lint
```
```bash
npm run test:unit
```
```bash
npm run build
```
```bash
npm run test:e2e
```

- `npm run build` also runs the animal check (`npm run validate` runs it on its own).
- `test:e2e` needs `npm run build` first. It tests the real production build on two emulated devices: a Pixel 7 phone and a Galaxy Tab S4 tablet, both in landscape. It covers offline use, multi-finger touches, the clear button, saving, and updating from one version to the next.

## Where things live

| Path | What |
|---|---|
| `src/animals/` | the animal SVGs, `animals.json`, optional `sounds/` |
| `src/coloring.ts` | coloring screen: drawing, palette, clear, autosave |
| `src/picker.ts` | animal picker |
| `src/storage.ts` | saved drawings (IndexedDB, versioned schema) |
| `src/pwa.ts` | offline support and the update policy |
| `src/audio.ts` | sound effects (generated in code, no audio files) |
| `assets/icon.svg` | app icon source. After editing it, run `npm run icons` |
| `scripts/` | animal validation and icon generation |
| `tests/` | unit tests (Vitest) and end-to-end tests (Playwright) |
| `dev/` | art review page (development only) |
| `MANUAL_CHECKLIST.md` | what to check by hand on the real phone and tablet |
