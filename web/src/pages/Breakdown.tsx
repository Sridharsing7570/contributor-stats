import { useMemo } from 'react';
import { Filters as FilterBar } from '../components/Filters';
import { StatTiles } from '../components/Bits';
import { ChartCard, CommitsBar, RepoShareChart, WeeklyChart } from '../components/Charts';
import { ContributorTable } from '../components/ContributorTable';
import { contributorRows, DEFAULT_FILTERS, hasDateFilter, repoShares, sumRows, weeklyCommits, type Filters } from '../lib/aggregate';
import { createSeriesScale } from '../lib/colors';
import { fmt } from '../lib/format';
import type { Stats } from '../types';

interface Props {
  stats: Stats;
  filters: Filters;
  onFilters(next: Filters): void;
  /** When set, the whole breakdown is for this one repo. */
  repo?: string;
  children?: React.ReactNode;
}

/** Filters, totals, charts and the contributor table: shared by the overview and repo pages. */
export function Breakdown({ stats, filters, onFilters, repo, children }: Props) {
  const scoped = useMemo<Filters>(() => (repo ? { ...filters, repos: [repo] } : filters), [filters, repo]);
  const rows = useMemo(() => contributorRows(stats, scoped), [stats, scoped]);
  const totals = sumRows(rows);

  // Colour ranking ignores the date/repo filters, so filtering never repaints anyone.
  const scale = useMemo(
    () => createSeriesScale(contributorRows(stats, { ...DEFAULT_FILTERS, repos: repo ? [repo] : null })),
    [stats, repo],
  );
  const weekly = useMemo(() => weeklyCommits(stats, scoped, (id) => scale.keyOf(id)), [stats, scoped, scale]);
  const shares = useMemo(() => (repo ? [] : repoShares(stats, scoped, (id) => scale.keyOf(id))), [stats, scoped, scale, repo]);
  const shareKeys = useMemo(() => [...new Set(shares.flatMap((s) => Object.keys(s)))].filter((k) => k !== 'repo' && k !== 'total'), [shares]);
  const lineNote = filters.excludeGenerated ? 'generated files excluded' : 'all files';

  return (
    <>
      <FilterBar stats={stats} filters={filters} onChange={onFilters} showRepos={!repo} />
      <StatTiles
        items={[
          { label: 'Contributors', value: fmt(rows.length) },
          { label: 'Commits', value: fmt(totals.commits), note: `plus ${fmt(totals.merges)} merges` },
          { label: 'Lines added', value: fmt(totals.added), note: lineNote },
          { label: 'Lines deleted', value: fmt(totals.deleted), note: lineNote },
        ]}
      />
      <div className="chart-grid">
        <div className={repo ? 'span-2' : undefined}>
          <ChartCard title="Commits per contributor" hint="Merge commits not included.">
            <CommitsBar rows={rows} />
          </ChartCard>
        </div>
        {!repo && (
          <ChartCard title="Share of commits per repo" hint="Who made each repo's commits, as a percentage.">
            <RepoShareChart data={shares} keys={shareKeys} scale={scale} />
          </ChartCard>
        )}
        <div className="span-2">
          <ChartCard title="Commits over time" hint="Commits per week for each contributor.">
            <WeeklyChart data={weekly.data} keys={weekly.keys} scale={scale} />
          </ChartCard>
        </div>
      </div>
      <section className="card">
        <h2>Contributors</h2>
        <ContributorTable rows={rows} showRepos={!repo} filesAreAllTime={hasDateFilter(filters)} />
      </section>
      {children}
    </>
  );
}
