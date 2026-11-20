/*
 * Loaded synchronously in <head> — the CSP forbids inline scripts, so this tiny
 * external file is how the "JS is available" and "motion is welcome" classes
 * exist before first paint. Every hide-before-reveal style is gated on
 * `html.motion-ok`, which keeps no-JS and reduced-motion visitors on a fully
 * visible page. Must stay dependency-free and tiny: it blocks rendering.
 */
const html = document.documentElement;
html.classList.add('js');
if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  html.classList.add('motion-ok');
}
