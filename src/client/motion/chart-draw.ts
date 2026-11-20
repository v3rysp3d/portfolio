/*
 * Builds the /lab pass-rate SVG line chart from a [data-chart] JSON payload.
 * The element sits inside a <figure class="ascii-chart"> next to a
 * server-rendered sr-only mirror <table> — the table is the no-JS and
 * screen-reader rendering, so this only ever replaces the [data-chart] div's
 * own content, never its siblings.
 */
interface ChartPoint {
  x?: string;
  label?: string;
  v: number;
}

export function initCharts(): void {
  document.querySelectorAll<HTMLElement>('[data-chart]').forEach(buildChart);
  // Meter fills: the CSP forbids inline style attributes, so the server emits
  // data-pct and the custom property is assigned here (CSSOM is CSP-clean).
  // The numeric value is always adjacent text, so no-JS loses only decoration.
  document.querySelectorAll<HTMLElement>('.meter__fill[data-pct]').forEach((fill) => {
    fill.style.setProperty('--pct', `${fill.dataset.pct}%`);
  });
}

function buildChart(host: HTMLElement): void {
  let pts: ChartPoint[];
  try {
    pts = JSON.parse(host.dataset.chart ?? '');
  } catch {
    return;
  }
  if (!Array.isArray(pts) || !pts.length) return;

  const W = 640;
  const H = 240;
  const padL = 34;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const ys = pts.map((p) => p.v);
  const minY = Math.min(70, Math.floor(Math.min(...ys) / 10) * 10);
  const maxY = 100;
  const denom = Math.max(1, pts.length - 1);
  const xAt = (i: number): number => padL + (i / denom) * (W - padL - padR);
  const yAt = (v: number): number => padT + (1 - (v - minY) / (maxY - minY)) * (H - padT - padB);
  const target = host.dataset.target ? parseFloat(host.dataset.target) : null;

  const grid: string[] = [];
  for (let g = minY; g <= maxY; g += 10) {
    const y = yAt(g);
    grid.push(`<line class="chart-grid" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>`);
    grid.push(`<text class="chart-lbl" x="${padL - 6}" y="${y + 3}" text-anchor="end">${g}</text>`);
  }
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${xAt(pts.length - 1).toFixed(1)},${yAt(minY)} L${xAt(0).toFixed(1)},${yAt(minY)} Z`;
  const dots = pts
    .map((p, i) => {
      const last = i === pts.length - 1;
      return (
        `<circle class="chart-pt${last ? ' chart-pt--last' : ''}" cx="${xAt(i).toFixed(1)}" cy="${yAt(p.v).toFixed(1)}" r="${last ? 5 : 3.5}"/>` +
        `<text class="chart-lbl" x="${xAt(i).toFixed(1)}" y="${(yAt(p.v) - 10).toFixed(1)}" text-anchor="middle">${p.label || ''} ${p.v}</text>`
      );
    })
    .join('');
  const ticks = pts
    .map((p, i) => `<text class="chart-lbl" x="${xAt(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${p.x || ''}</text>`)
    .join('');
  const targetLine =
    target != null
      ? `<line class="chart-target" x1="${padL}" y1="${yAt(target)}" x2="${W - padR}" y2="${yAt(target)}"/>` +
        `<text class="chart-lbl" x="${W - padR}" y="${yAt(target) - 5}" text-anchor="end">TARGET ${target}</text>`
      : '';

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
      <defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.20"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient></defs>
      <g class="chart-grid-g">${grid.join('')}</g>
      ${targetLine}
      <path class="chart-area" d="${area}"/>
      <path class="chart-line chart-line--draw" d="${line}"/>
      <g class="chart-dots">${dots}</g>
      <g class="chart-ticks">${ticks}</g>
    </svg>`;
  const path = host.querySelector<SVGPathElement>('.chart-line--draw');
  if (path) {
    path.style.setProperty('--len', String(path.getTotalLength()));
  }
}
