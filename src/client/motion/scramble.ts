/*
 * Mono text scramble — characters decode left-to-right in blueprint glyphs.
 * Runs on nav links (hover) and eyebrow labels (once, on first reveal).
 * The accessible name is pinned via aria-label before any scrambling, so
 * assistive tech never sees the noise.
 */
const GLYPHS = '#§/<>[]{}=+*·01';

function scramble(el: HTMLElement, duration = 420): void {
  const original = el.dataset.scrambleText ?? el.textContent ?? '';
  if (!original.trim() || el.dataset.scrambling) return;
  el.dataset.scrambleText = original;
  if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', original);
  el.dataset.scrambling = '1';

  const start = performance.now();
  const tick = (now: number): void => {
    // Settled early (see settleAll) — leave the restored text alone.
    if (!el.dataset.scrambling) return;
    const progress = Math.min(1, (now - start) / duration);
    const settled = Math.floor(original.length * progress);
    let text = original.slice(0, settled);
    for (let i = settled; i < original.length; i++) {
      const ch = original[i];
      text += ch === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    }
    el.textContent = text;
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = original;
      delete el.dataset.scrambling;
    }
  };
  requestAnimationFrame(tick);
}

/** Snap every mid-decode label back to its real text (e.g. before printing). */
function settleAll(): void {
  document.querySelectorAll<HTMLElement>('[data-scrambling]').forEach((el) => {
    el.textContent = el.dataset.scrambleText ?? el.textContent;
    delete el.dataset.scrambling;
  });
}

export function initScramble(): () => void {
  const cleanups: Array<() => void> = [];

  // A print started mid-animation would otherwise capture glyph noise.
  window.addEventListener('beforeprint', settleAll);
  cleanups.push(() => window.removeEventListener('beforeprint', settleAll));

  // Nav links decode on hover.
  document.querySelectorAll<HTMLElement>('.topnav__link').forEach((link) => {
    const onEnter = (): void => scramble(link, 360);
    link.addEventListener('pointerenter', onEnter);
    cleanups.push(() => link.removeEventListener('pointerenter', onEnter));
  });

  // Eyebrow labels decode once when their section first reveals.
  const labels = Array.from(document.querySelectorAll<HTMLElement>('.eyebrow__label'));
  if (labels.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            scramble(entry.target as HTMLElement, 520);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 },
    );
    labels.forEach((label) => io.observe(label));
    cleanups.push(() => io.disconnect());
  }

  return () => cleanups.forEach((fn) => fn());
}
