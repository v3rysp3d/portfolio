/*
 * Cross-document View Transitions element continuity: the clicked project
 * card morphs into the project-detail header. The base cross-fade is pure
 * CSS (@view-transition in motion.css); this only pairs names on the two
 * pages. Feature-detected — browsers without pagereveal ignore all of it.
 */
export function initTransitions(): void {
  if (!('startViewTransition' in document) || !('onpagereveal' in window)) return;

  // Old page: name the card being navigated away from before the snapshot.
  document.addEventListener('click', (event) => {
    const card = (event.target as Element).closest<HTMLElement>('.project-card');
    if (card) card.style.viewTransitionName = 'project-hero';
  });

  // New page: pair the detail header with the card that was clicked.
  (window as unknown as { addEventListener(type: 'pagereveal', cb: () => void): void }).addEventListener(
    'pagereveal',
    () => {
      const header = document.querySelector<HTMLElement>('.project__header');
      if (header) header.style.viewTransitionName = 'project-hero';
    },
  );
}
