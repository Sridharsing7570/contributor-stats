const number = new Intl.NumberFormat();
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

export const fmt = (n: number) => number.format(n);
export const fmtCompact = (n: number) => compact.format(n);

/** Formats a YYYY-MM-DD (or ISO timestamp) as a calendar date, without time-zone shifts. */
export function fmtDate(date: string | null | undefined): string {
  if (!date) return '–';
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtWeek(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
