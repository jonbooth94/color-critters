import './style.css';
import { animals, type Animal } from './animals';
import { isMuted, setMuted, unlockAudio } from './audio';
import { ColoringScreen } from './coloring';
import { soundOffIcon, soundOnIcon } from './icons';
import { Picker } from './picker';
import { initPwa, maybeApplyUpdate } from './pwa';

document.documentElement.dataset.version = __APP_VERSION__;

// ---------- Kid-proofing ----------
for (const type of ['contextmenu', 'selectstart', 'dragstart', 'gesturestart', 'dblclick']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
// Resume audio on every gesture (Android suspends it when the app is backgrounded).
document.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });

// ---------- Screens ----------
const pickerEl = document.getElementById('picker') as HTMLElement;
const coloringEl = document.getElementById('coloring') as HTMLElement;
let screen: 'picker' | 'coloring' = 'picker';

const coloring = new ColoringScreen(goHome, (animal) => {
  picker.hide(animal.id);
  goHome();
});
const picker = new Picker(document.getElementById('grid') as HTMLElement, animals, openAnimal);

function openAnimal(animal: Animal): void {
  screen = 'coloring';
  pickerEl.hidden = true;
  coloringEl.hidden = false;
  void coloring.open(animal);
}

function goHome(): void {
  const id = coloring.currentAnimal?.id;
  const saved = coloring.close();
  screen = 'picker';
  coloringEl.hidden = true;
  pickerEl.hidden = false;
  void saved.then(async () => {
    if (id) await picker.refresh(id);
    maybeApplyUpdate();
  });
}

// ---------- Mute toggle ----------
const muteBtn = document.getElementById('mute') as HTMLButtonElement;
function renderMute(): void {
  const muted = isMuted();
  muteBtn.innerHTML = muted ? soundOffIcon : soundOnIcon;
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
}
muteBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  renderMute();
});
renderMute();

// ---------- Autosave when leaving the app ----------
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void coloring.flush();
});
window.addEventListener('pagehide', () => void coloring.flush());

// ---------- Error recovery: any uncaught error returns to the picker ----------
let lastRecovery = 0;
function recover(): void {
  const now = Date.now();
  if (now - lastRecovery < 2000) return; // avoid loops if the picker itself is failing
  lastRecovery = now;
  try {
    if (screen === 'coloring') goHome();
    else picker.refreshAll();
  } catch {
    // nothing more we can safely do
  }
}
window.addEventListener('error', recover);
window.addEventListener('unhandledrejection', recover);

// ---------- Offline + updates ----------
initPwa(() => screen === 'picker' && coloring.isSaved());

void (async () => {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // not supported; drawings still save, just without the persistence guarantee
  }
})();
