/*
 * Pointer FX engine — one pointermove listener and one rAF loop drive every
 * cursor-reactive background layer:
 *   · .crosshair      — full-viewport hairline reticle tracking the pointer
 *   · .grid-spotlight — the blueprint grid "lights up" around the cursor,
 *                       intensity keyed to pointer speed and decaying at rest
 *   · .cursor         — custom reticle cursor: instant dot + eased ring that
 *                       expands over interactive elements
 * Fine pointers only; fully torn down when motion is disabled mid-session.
 * The native cursor is restored over text fields (and everywhere on no-JS).
 */
import { finePointer } from './prefs';

const INTERACTIVE = 'a, button, [role="button"], summary, label, .suggestion-chip';
const TEXT_FIELDS = 'input, textarea, select';

export function initPointerFX(): () => void {
  if (!finePointer()) return () => {};

  const crosshair = document.querySelector<HTMLElement>('.crosshair');
  const spotlight = document.querySelector<HTMLElement>('.grid-spotlight');
  const cursor = document.querySelector<HTMLElement>('.cursor');
  if (!crosshair && !spotlight && !cursor) return () => {};

  document.body.classList.add('has-custom-cursor');

  let raf = 0;
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let ringX = targetX;
  let ringY = targetY;
  let lastX = targetX;
  let lastY = targetY;
  let energy = 0; // 0..1 — spotlight brightness, fed by pointer speed
  let idle = true;

  const frame = (): void => {
    raf = 0;
    // Speed → energy (rise fast, decay slow: the grid "cools down" at rest).
    const dist = Math.hypot(targetX - lastX, targetY - lastY);
    lastX = targetX;
    lastY = targetY;
    energy = Math.min(1, energy * 0.94 + dist * 0.006);

    if (crosshair) {
      crosshair.style.setProperty('--cx', `${targetX}px`);
      crosshair.style.setProperty('--cy', `${targetY}px`);
    }
    if (spotlight) {
      spotlight.style.setProperty('--mx', `${targetX}px`);
      spotlight.style.setProperty('--my', `${targetY}px`);
      spotlight.style.setProperty('--energy', energy.toFixed(3));
    }
    if (cursor) {
      ringX += (targetX - ringX) * 0.18;
      ringY += (targetY - ringY) * 0.18;
      cursor.style.setProperty('--dx', `${targetX}px`);
      cursor.style.setProperty('--dy', `${targetY}px`);
      cursor.style.setProperty('--rx', `${ringX}px`);
      cursor.style.setProperty('--ry', `${ringY}px`);
    }

    // Keep animating while the ring is catching up or energy is draining.
    if (!idle || energy > 0.01 || Math.hypot(targetX - ringX, targetY - ringY) > 0.5) {
      raf = requestAnimationFrame(frame);
    }
  };
  const kick = (): void => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const onMove = (event: PointerEvent): void => {
    targetX = event.clientX;
    targetY = event.clientY;
    idle = false;
    document.body.classList.add('has-pointer');
    kick();
    idle = true;
  };

  const onOver = (event: PointerEvent): void => {
    const el = event.target as Element;
    if (!cursor) return;
    cursor.classList.toggle('is-active', !!el.closest?.(INTERACTIVE));
    cursor.classList.toggle('is-muted', !!el.closest?.(TEXT_FIELDS));
  };

  const onLeave = (): void => {
    document.body.classList.remove('has-pointer');
  };
  const onDown = (): void => cursor?.classList.add('is-pressed');
  const onUp = (): void => cursor?.classList.remove('is-pressed');

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerover', onOver, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerover', onOver);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    document.body.classList.remove('has-pointer', 'has-custom-cursor');
  };
}
