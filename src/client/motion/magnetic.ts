/*
 * Magnetic buttons — primary controls lean toward the cursor inside a small
 * radius and spring back elastically on leave. GSAP quickTo keeps it on the
 * compositor; strength is deliberately restrained (editorial, not gimmick).
 */
import { gsap } from 'gsap';
import { finePointer } from './prefs';

const SELECTOR = '.btn, .monogram, .nav-toggle';
const MAX_SHIFT = 7; // px at the element's edge

export function initMagnetic(): () => void {
  if (!finePointer()) return () => {};

  const cleanups: Array<() => void> = [];

  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    const toX = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
    const toY = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });

    const onMove = (event: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      const relX = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const relY = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      toX(Math.max(-1, Math.min(1, relX)) * MAX_SHIFT);
      toY(Math.max(-1, Math.min(1, relY)) * MAX_SHIFT * 0.75);
    };
    const onLeave = (): void => {
      gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
    };

    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      gsap.set(el, { x: 0, y: 0 });
    });
  });

  return () => cleanups.forEach((fn) => fn());
}
