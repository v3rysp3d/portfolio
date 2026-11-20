/* Mobile nav toggle + destructive-action confirms. Progressive enhancement
 * only — the site is fully functional without any of this. */

export function initNav(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const isOpen = document.body.hasAttribute('data-menu-open');
      if (isOpen) {
        document.body.removeAttribute('data-menu-open');
        toggle.setAttribute('aria-expanded', 'false');
      } else {
        document.body.setAttribute('data-menu-open', '');
        toggle.setAttribute('aria-expanded', 'true');
      }
    });
  }

  // Close the mobile menu when a link is followed.
  document.querySelectorAll<HTMLAnchorElement>('.topnav__link').forEach((link) => {
    link.addEventListener('click', () => {
      document.body.removeAttribute('data-menu-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

export function initConfirms(): void {
  document.querySelectorAll<HTMLFormElement>('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      const message = form.getAttribute('data-confirm');
      if (message && !window.confirm(message)) {
        event.preventDefault();
      }
    });
  });
}

/** Highlights the topnav link whose section is currently in view (home page). */
export function initScrollspy(): () => void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.topnav__link[href*="#"]'));
  if (!links.length || !('IntersectionObserver' in window)) return () => {};

  const byId = new Map<string, HTMLAnchorElement>();
  for (const link of links) {
    const hash = new URL(link.href, window.location.href).hash.slice(1);
    const section = hash ? document.getElementById(hash) : null;
    if (section) byId.set(section.id, link);
  }
  if (!byId.size) return () => {};

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = byId.get((entry.target as HTMLElement).id);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.toggle('is-active', l === link));
        }
      });
    },
    { rootMargin: '-30% 0px -60% 0px' },
  );
  byId.forEach((_link, id) => {
    const section = document.getElementById(id);
    if (section) io.observe(section);
  });
  return () => io.disconnect();
}
