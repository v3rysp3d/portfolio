/*
 * Home-page choreography beyond the shared reveal system: the about
 * pull-quote's word-by-word scrub. The quote is server-rendered plain text;
 * this wraps words in spans itself, so no-JS visitors read the same sentence.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initHome(): void {
  if (!document.body.classList.contains('page-home')) return;

  const quote = document.querySelector<HTMLElement>('[data-pullquote]');
  if (!quote?.textContent) return;

  const words = quote.textContent.trim().split(/\s+/);
  quote.textContent = '';
  words.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = word;
    quote.appendChild(span);
    if (i < words.length - 1) quote.appendChild(document.createTextNode(' '));
  });

  gsap.registerPlugin(ScrollTrigger);
  gsap.from(quote.querySelectorAll('.word'), {
    opacity: 0.14,
    y: 6,
    stagger: 0.045,
    ease: 'power2.out',
    scrollTrigger: { trigger: quote, start: 'top 85%', end: 'top 45%', scrub: true },
  });
}
