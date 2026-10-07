import { OTHERS } from './aggregate';

/** Seven categorical slots; everyone past the seventh folds into "Others". */
export const SERIES_SLOTS = 7;

export interface SeriesScale {
  /** Series key for a contributor: their own id, or OTHERS. */
  keyOf(id: string): string;
  color(key: string): string;
  label(key: string): string;
  /** Keys in legend order, limited to those present. */
  order(present: Iterable<string>): string[];
}

/**
 * Colours follow the person, not their current rank: the ranking is fixed for
 * a page, so changing a filter never repaints a line.
 */
export function createSeriesScale(ranked: Array<{ id: string; name: string }>): SeriesScale {
  const top = ranked.slice(0, SERIES_SLOTS);
  const slot = new Map(top.map((c, i) => [c.id, i + 1]));
  const names = new Map(top.map((c) => [c.id, c.name]));
  return {
    keyOf: (id) => (slot.has(id) ? id : OTHERS),
    color: (key) => (slot.has(key) ? `var(--series-${slot.get(key)})` : 'var(--series-others)'),
    label: (key) => names.get(key) ?? 'Others',
    order: (present) => {
      const set = new Set(present);
      return [...top.map((c) => c.id), OTHERS].filter((k) => set.has(k));
    },
  };
}
