import { useMemo } from 'react';
import { StatTiles, TopFilesTable } from '../components/Bits';
import { ChartCard, WeeklyChart } from '../components/Charts';
import { Filters as FilterBar } from '../components/Filters';
import { hasDateFilter, topFilesFor, totalsFor, weeklyCommits, type Filters } from '../lib/aggregate';
import { createSeriesScale } from '../lib/colors';
import { fmt, fmtDate } from '../lib/format';
import { repoHref } from '../lib/router';
import type { Stats } from '../types';
import { NotFound } from './RepoPage';

export function ContributorPage({ stats, filters, onFilters, id }: { stats: Stats; filters: Filters; onFilters(next: Filters): void; id: string }) {
  const person = stats.contributors.find((c) => c.id === id);
  const data = useMemo(() => {
    if (!person) return null;
    const perRepo = Object.keys(person.repos)
      .map((repo) => ({ repo, ...totalsFor(person, { ...filters, repos: filters.repos === null || filters.repos.includes(repo) ? [repo] : [] }) }))
      .filter((r) => r.commits + r.merges > 0)
      .sort((a, b) => b.commits - a.commits);
    // Colours are tied to the repo's position in the data set, not to this person's ranking.
    const scale = createSeriesScale(stats.repos.map((r) => ({ id: r.name, name: r.name })));
    const weekly = weeklyCommits(stats, filters, (cid, repo) => (cid === person.id ? scale.keyOf(repo) : null));
    return { totals: totalsFor(person, filters), perRepo, scale, weekly, files: topFilesFor(person, filters) };
  }, [stats, person, filters]);

  if (!person || !data) return <NotFound what="That contributor" />;
  const { totals, perRepo, scale, weekly, files } = data;
  const lineNote = filters.excludeGenerated ? 'generated files excluded' : 'all files';
  const star = hasDateFilter(filters) ? '*' : '';

  return (
    <>
      <a className="back" href="#/">← Overview</a>
      <h1>{person.name}</h1>
      <p className="subtitle">First commit {fmtDate(totals.first)} · last commit {fmtDate(totals.last)}</p>
      <FilterBar stats={stats} filters={filters} onChange={onFilters} />
      <StatTiles
        items={[
          { label: 'Commits', value: fmt(totals.commits), note: `plus ${fmt(totals.merges)} merges` },
          { label: 'Lines added', value: fmt(totals.added), note: lineNote },
          { label: 'Lines deleted', value: fmt(totals.deleted), note: lineNote },
          { label: 'Files touched', value: fmt(totals.files), note: star ? 'whole history' : undefined },
          { label: 'Active days', value: fmt(totals.activeDays) },
          { label: 'Repos', value: fmt(totals.repos) },
        ]}
      />
      <ChartCard title="Activity over time" hint="Commits per week, stacked by repo.">
        <WeeklyChart data={weekly.data} keys={weekly.keys} scale={scale} kind="bar" />
      </ChartCard>
      <section className="card">
        <h2>By repo</h2>
        {perRepo.length === 0 ? (
          <p className="empty">No commits match these filters.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Repo</th>
                  <th className="num">Commits</th>
                  <th className="num">Merges</th>
                  <th className="num">Files{star}</th>
                  <th className="num">Added</th>
                  <th className="num">Deleted</th>
                  <th className="num">Active days</th>
                  <th>First commit</th>
                  <th>Last commit</th>
                </tr>
              </thead>
              <tbody>
                {perRepo.map((r) => (
                  <tr key={r.repo}>
                    <th scope="row"><a href={repoHref(r.repo)}>{r.repo}</a></th>
                    <td className="num">{fmt(r.commits)}</td>
                    <td className="num">{fmt(r.merges)}</td>
                    <td className="num">{fmt(r.files)}</td>
                    <td className="num added">+{fmt(r.added)}</td>
                    <td className="num deleted">−{fmt(r.deleted)}</td>
                    <td className="num">{fmt(r.activeDays)}</td>
                    <td>{fmtDate(r.first)}</td>
                    <td>{fmtDate(r.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {star && <p className="footnote">* File counts cover the whole history of each repo, not just the selected dates.</p>}
      </section>
      <section className="card">
        <h2>Most edited files</h2>
        <p className="hint">Top 10 by number of commits, over the whole history of the selected repos.</p>
        <TopFilesTable files={files} showRepo />
      </section>
    </>
  );
}
