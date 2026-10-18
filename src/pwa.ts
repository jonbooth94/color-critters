import { registerSW } from 'virtual:pwa-register';

// Update policy: the new service worker downloads silently and waits. It is only
// activated (which reloads the page) when the app is on the animal picker and the
// current drawing has been saved, including right after a fresh launch.
// Never while the coloring screen is open; no banners or prompts.

const HOUR = 60 * 60 * 1000;

let updateReady = false;
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;
let isSafe: () => boolean = () => false;

export function initPwa(canApply: () => boolean): void {
  isSafe = canApply;
  if (!('serviceWorker' in navigator)) return;

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      maybeApplyUpdate();
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // The browser checks for a new version on launch (registration). Also check hourly while visible.
      let lastCheck = Date.now();
      const check = () => {
        if (document.visibilityState !== 'visible' || Date.now() - lastCheck < HOUR) return;
        lastCheck = Date.now();
        registration.update().catch(() => undefined); // offline is fine
      };
      setInterval(check, 60 * 1000);
      document.addEventListener('visibilitychange', check);
    },
  });
}

export function maybeApplyUpdate(): void {
  if (!updateReady || !applyUpdate || !isSafe()) return;
  updateReady = false;
  // Reload as soon as the new version takes control. The plugin only does this itself
  // when the page was already controlled at launch, so a first-ever session would
  // otherwise keep running old code under the new service worker.
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  void applyUpdate(true);
}
