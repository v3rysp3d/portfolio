/*
 * 3D tilt + glare for card surfaces. Cards pivot a few degrees toward the
 * pointer with a moving highlight (the glare position rides --gx/--gy set
 * here; the gradient itself lives in CSS). Compositor-only transforms via
 * GSAP quickTo; everything resets on leave and on teardown.
 */
import { gsap } from 'gsap';
import { finePointer } from './prefs';

const SELECTOR = '.project-card, .stat-card, .attack-card, .card';
const MAX_TILT = 5; // degrees

export function initTilt(): () => void {
  if (!finePointer()) return () => {};

  const cleanups: Array<() => void> = [];

  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    el.classList.add('tilt');
    const toRX = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power2.out' });
    const toRY = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power2.out' });

    const onMove = (event: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width; // 0..1
      const py = (event.clientY - rect.top) / rect.height;
      toRY((px - 0.5) * 2 * MAX_TILT);
      toRX((0.5 - py) * 2 * MAX_TILT);
      el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    };
    const onLeave = (): void => {
      gsap.to(el, { rotationX: 0, rotationY: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
    };

    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.classList.remove('tilt');
      gsap.set(el, { rotationX: 0, rotationY: 0 });
    });
  });

  return () => cleanups.forEach((fn) => fn());
}
