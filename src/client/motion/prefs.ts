/*
 * Motion preference gate — the single source of truth for whether decorative
 * motion may run. boot.ts sets html.motion-ok pre-paint; this module answers
 * the same question at runtime and lets the app tear motion down live if the
 * visitor flips their OS setting mid-session.
 */
const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

export function motionOK(): boolean {
  return !reduceQuery.matches;
}

export function finePointer(): boolean {
  return window.matchMedia('(pointer: fine)').matches;
}

export function saveData(): boolean {
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

export function onMotionChange(callback: (ok: boolean) => void): void {
  reduceQuery.addEventListener('change', () => {
    document.documentElement.classList.toggle('motion-ok', !reduceQuery.matches);
    callback(!reduceQuery.matches);
  });
}
