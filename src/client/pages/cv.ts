/* CV page: print button (the print stylesheet does the real work). */
export function initCv(): void {
  const root = document.querySelector<HTMLElement>('[data-cv]');
  if (!root) return;
  root.querySelector<HTMLButtonElement>('[data-print-cv]')?.addEventListener('click', () => {
    window.print();
  });
}
