/*
 * Hero scene bootstrap — the lazily-imported chunk. Owns the rAF loop and
 * all lifecycle hygiene: pauses off-screen and on hidden tabs, caps DPR via
 * the scene, survives context loss by handing back to the SVG fallback, and
 * tears down fully when motion is disabled mid-session.
 */
import { createScene, type HeroScene } from './scene';

export function startHero(canvas: HTMLCanvasElement): () => void {
  let scene: HeroScene | null = null;
  try {
    scene = createScene(canvas);
  } catch {
    return () => {};
  }

  const hero = canvas.closest<HTMLElement>('.hero') ?? canvas.parentElement ?? document.body;
  let raf = 0;
  let visible = true;
  let pageVisible = !document.hidden;
  const start = performance.now();

  const frame = (now: number): void => {
    raf = 0;
    if (!scene || !visible || !pageVisible) return;
    // Scroll progress: how far the hero has scrolled out of the viewport.
    const rect = hero.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
    scene.setScroll(progress);
    scene.render((now - start) / 1000);
    raf = requestAnimationFrame(frame);
  };
  const kick = (): void => {
    if (!raf && visible && pageVisible) raf = requestAnimationFrame(frame);
  };

  const resize = (): void => {
    const rect = hero.getBoundingClientRect();
    scene?.resize(rect.width, rect.height);
  };
  resize();
  window.addEventListener('resize', resize);

  const onPointer = (event: PointerEvent): void => {
    const nx = (event.clientX / window.innerWidth) * 2 - 1;
    const ny = (event.clientY / window.innerHeight) * 2 - 1;
    scene?.setPointer(nx, ny);
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = !!entry?.isIntersecting;
      kick();
    },
    { threshold: 0 },
  );
  io.observe(hero);

  const onVisibility = (): void => {
    pageVisible = !document.hidden;
    kick();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onContextLost = (event: Event): void => {
    event.preventDefault();
    teardown(); // SVG fallback underneath simply stays visible
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // Fade the canvas in over the static SVG once the first frame exists.
  canvas.classList.add('is-live');
  kick();

  function teardown(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    io.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.classList.remove('is-live');
    scene?.destroy();
    scene = null;
  }
  return teardown;
}
