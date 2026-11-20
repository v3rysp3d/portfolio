/**
 * Pure helpers used inside EJS templates. EJS auto-escapes `<%= %>`, but where
 * we need controlled HTML (paragraph breaks in free text) we escape first and
 * only then introduce markup, so user/admin content can never inject script.
 */

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders plain text as safe HTML paragraphs: blank lines separate paragraphs,
 * single newlines become <br>. All content is escaped before markup is added.
 * Intended for use with EJS `<%- %>` (unescaped) output.
 */
export function paragraphsHtml(text: string | null | undefined): string {
  if (!text) return '';
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/** "Jan 2024 — Present" style range from free-text start/end values. */
export function formatDateRange(start: string | null, end: string | null): string {
  if (start && end) return `${start} — ${end}`;
  if (start) return `${start} — Present`;
  if (end) return end;
  return '';
}

/** Up to two initials from a name, for the monogram. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Display the bare host of a URL (e.g. "github.com"), or '' if invalid. */
export function displayHost(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Short, readable form of a profile URL: host plus path, without scheme,
 * "www." or a trailing slash (e.g. "linkedin.com/in/jane-doe"). Printed CVs
 * can't be clicked, so the visible text has to be the real address.
 */
export function displayUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return (parsed.host.replace(/^www\./, '') + parsed.pathname).replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** Two-digit, 1-based index label for editorial numbering (§01, §02 …). */
export function indexLabel(index: number): string {
  return String(index + 1).padStart(2, '0');
}
