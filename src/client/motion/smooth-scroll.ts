/*
 * Lenis smooth scrolling driven by the GSAP ticker, with ScrollTrigger kept
 * in sync — the canonical integration. Native keyboard scrolling and touch
 * behaviour are preserved (Lenis does not hijack touch by default).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

const TOPBAR_OFFSET = -78;

export function initSmoothScroll(): () => void {
  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({ autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);

  const raf = (time: number): void => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  // Same-page anchor links glide via Lenis and hand focus to the target so
  // keyboard users land where the viewport does.
  const onClick = (event: MouseEvent): void => {
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href*="#"]');
    if (!anchor) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.pathname !== window.location.pathname || !url.hash) return;
    const target = document.getElementById(url.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    history.pushState(null, '', url.hash);
    lenis.scrollTo(target, { offset: TOPBAR_OFFSET });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  document.addEventListener('click', onClick);

  return () => {
    document.removeEventListener('click', onClick);
    gsap.ticker.remove(raf);
    lenis.destroy();
    ScrollTrigger.killAll();
  };
}
