import { TopFilesTable } from '../components/Bits';
import type { Filters } from '../lib/aggregate';
import { fmtDate } from '../lib/format';
import type { Stats } from '../types';
import { Breakdown } from './Breakdown';

export function RepoPage({ stats, filters, onFilters, name }: { stats: Stats; filters: Filters; onFilters(next: Filters): void; name: string }) {
  const repo = stats.repos.find((r) => r.name === name);
  if (!repo) return <NotFound what={`Repo “${name}”`} />;
  return (
    <>
      <a className="back" href="#/">← Overview</a>
      <h1>{repo.name}</h1>
      <p className="subtitle">First commit {fmtDate(repo.firstCommit)} · last commit {fmtDate(repo.lastCommit)}</p>
      <Breakdown stats={stats} filters={filters} onFilters={onFilters} repo={repo.name}>
        <section className="card">
          <h2>Most edited files</h2>
          <p className="hint">By number of commits, over the whole history of the repo.</p>
          <TopFilesTable files={filters.excludeGenerated ? repo.topFilesFiltered : repo.topFiles} />
        </section>
      </Breakdown>
    </>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <section className="card">
      <h1>Not found</h1>
      <p>{what} is not in this data set. <a href="#/">Back to the overview</a></p>
    </section>
  );
}
