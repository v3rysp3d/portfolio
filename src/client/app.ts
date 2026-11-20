/*
 * Public-site entry. Dispatches feature modules by DOM hooks so one cached
 * bundle serves every page; each module no-ops when its target is absent.
 *
 * Two tiers:
 *   functional (always, JS-on): nav, confirms, chat enhancement
 *   decorative (only when motion-ok): smooth scroll, reveals, charts,
 *     crosshair, scrollspy, transitions, and the lazily-imported WebGL hero
 *
 * If the visitor flips their OS reduced-motion setting mid-session, every
 * decorative module is torn down and the page reverts to fully visible.
 */
import { initConfirms, initNav, initScrollspy } from './motion/nav';
import { initCharts } from './motion/chart-draw';
import { initMagnetic } from './motion/magnetic';
import { initPointerFX } from './motion/pointer';
import { motionOK, onMotionChange, saveData } from './motion/prefs';
import { initScramble } from './motion/scramble';
import { initTilt } from './motion/tilt';
import { initReveal } from './motion/reveal';
import { initSmoothScroll } from './motion/smooth-scroll';
import { initTransitions } from './motion/transitions';
import { initCv } from './pages/cv';
import { initHome } from './pages/home';
import { initInterviewChat } from './pages/interview';

initNav();
initConfirms();
initInterviewChat();
initCv();

// Charts render whenever JS is available — under reduced motion the CSS kill
// block shows them fully drawn, and the sr-only mirror table always exists.
initCharts();

let teardowns: Array<() => void> = [];

function startMotion(): void {
  teardowns.push(initSmoothScroll());
  teardowns.push(initReveal());
  teardowns.push(initPointerFX());
  teardowns.push(initMagnetic());
  teardowns.push(initTilt());
  teardowns.push(initScramble());
  teardowns.push(initScrollspy());
  initTransitions();
  initHome();
  maybeLoadHero();
}

function stopMotion(): void {
  teardowns.forEach((teardown) => teardown());
  teardowns = [];
}

function webgl2Supported(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function maybeLoadHero(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  if (!canvas || window.innerWidth < 768 || saveData() || !webgl2Supported()) return;
  // Lazy chunk: never even downloaded on mobile / reduced-motion / no-WebGL2.
  import('./hero/index')
    .then(({ startHero }) => teardowns.push(startHero(canvas)))
    .catch(() => {
      /* fallback SVG stays visible */
    });
}

if (motionOK()) startMotion();
onMotionChange((ok) => {
  if (ok) startMotion();
  else stopMotion();
});
