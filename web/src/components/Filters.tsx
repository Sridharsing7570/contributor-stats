import { addDays, type Filters as FilterState } from '../lib/aggregate';
import type { Stats } from '../types';

const PRESETS: Array<{ label: string; days: number | null }> = [
  { label: 'All time', days: null },
  { label: '1 year', days: 365 },
  { label: '90 days', days: 90 },
  { label: '30 days', days: 30 },
];

interface Props {
  stats: Stats;
  filters: FilterState;
  onChange(next: FilterState): void;
  /** Hidden on the repo page, where the repo is fixed. */
  showRepos?: boolean;
}

export function Filters({ stats, filters, onChange, showRepos = true }: Props) {
  const collected = stats.generatedAt.slice(0, 10);
  const allRepos = stats.repos.map((r) => r.name);

  const toggleRepo = (name: string) => {
    const current = filters.repos ?? [];
    const next = current.includes(name) ? current.filter((r) => r !== name) : [...current, name];
    onChange({ ...filters, repos: next.length === 0 || next.length === allRepos.length ? null : next });
  };
  const presetActive = (days: number | null) =>
    days === null ? !filters.from && !filters.to : filters.from === addDays(collected, -days) && filters.to === '';

  return (
    <section className="filters card" aria-label="Filters">
      {showRepos && allRepos.length > 1 && (
        <div className="filter-group">
          <span className="filter-label">Repos</span>
          <div className="chips">
            <button type="button" className="chip" aria-pressed={filters.repos === null} onClick={() => onChange({ ...filters, repos: null })}>
              All
            </button>
            {allRepos.map((name) => (
              <button type="button" key={name} className="chip" aria-pressed={filters.repos?.includes(name) ?? false} onClick={() => toggleRepo(name)}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="filter-group">
        <span className="filter-label">Dates</span>
        <div className="chips">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.label}
              className="chip"
              aria-pressed={presetActive(p.days)}
              onClick={() => onChange({ ...filters, from: p.days === null ? '' : addDays(collected, -p.days), to: '' })}
            >
              {p.label}
            </button>
          ))}
          <label className="date-field">
            <span>From</span>
            <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => onChange({ ...filters, from: e.target.value })} />
          </label>
          <label className="date-field">
            <span>To</span>
            <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => onChange({ ...filters, to: e.target.value })} />
          </label>
        </div>
      </div>

      <label className="switch" title={`Leaves out: ${stats.excludePaths.join(', ') || 'nothing configured'}`}>
        <input type="checkbox" checked={filters.excludeGenerated} onChange={(e) => onChange({ ...filters, excludeGenerated: e.target.checked })} />
        <span>Exclude generated files</span>
      </label>
    </section>
  );
}
