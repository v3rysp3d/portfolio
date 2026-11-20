/*
 * Scroll-reveal via IntersectionObserver. CSS only hides .reveal elements
 * under html.motion-ok, so this module is purely additive — if it never runs,
 * everything is visible. Also triggers count-ups and chart/meter fills the
 * moment their container enters the viewport.
 */
import { countUp } from './counters';

export function initReveal(): () => void {
  const revealables = Array.from(
    document.querySelectorAll<HTMLElement>('.reveal, .rule-draw, [data-countup], .ascii-chart, .meter'),
  );
  if (!revealables.length) return () => {};

  const revealNow = (el: HTMLElement): void => {
    el.classList.add('is-revealed');
    if (el.hasAttribute('data-countup')) countUp(el);
    el.querySelectorAll<HTMLElement>('[data-countup]').forEach(countUp);
  };

  if (!('IntersectionObserver' in window)) {
    revealables.forEach(revealNow);
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealNow(entry.target as HTMLElement);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
  );
  revealables.forEach((el) => io.observe(el));

  return () => {
    // Teardown = reveal everything (used when motion is disabled mid-session).
    revealables.forEach(revealNow);
    io.disconnect();
  };
}
