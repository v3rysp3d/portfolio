/*
 * Count-up decoration for [data-countup] elements. The server always renders
 * the final value in the markup; this only animates toward it, so no-JS and
 * reduced-motion visitors read the same number.
 */
import { motionOK } from './prefs';

export function countUp(el: HTMLElement): void {
  if (el.dataset.counted) return;
  el.dataset.counted = '1';
  const target = parseFloat(el.dataset.countup ?? '');
  if (Number.isNaN(target)) return;
  const dec = el.dataset.dec ? parseInt(el.dataset.dec, 10) : target % 1 ? 1 : 0;
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  if (!motionOK()) {
    el.textContent = prefix + target.toFixed(dec) + suffix;
    return;
  }
  const dur = 1100;
  const t0 = performance.now();
  const tick = (t: number): void => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + (target * eased).toFixed(dec) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
