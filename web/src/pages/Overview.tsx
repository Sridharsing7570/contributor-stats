import type { Filters } from '../lib/aggregate';
import { fmt, fmtDate } from '../lib/format';
import { repoHref } from '../lib/router';
import type { Stats } from '../types';
import { Breakdown } from './Breakdown';

export function Overview(props: { stats: Stats; filters: Filters; onFilters(next: Filters): void }) {
  return (
    <>
      <h1>Overview</h1>
      <Breakdown {...props}>
        <section className="card">
          <h2>Repositories</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Repo</th>
                  <th className="num">Contributors</th>
                  <th className="num">Commits</th>
                  <th className="num">Merges</th>
                  <th>First commit</th>
                  <th>Last commit</th>
                </tr>
              </thead>
              <tbody>
                {props.stats.repos.map((r) => (
                  <tr key={r.name}>
                    <th scope="row"><a href={repoHref(r.name)}>{r.name}</a></th>
                    <td className="num">{fmt(r.contributors)}</td>
                    <td className="num">{fmt(r.commits)}</td>
                    <td className="num">{fmt(r.mergeCommits)}</td>
                    <td>{fmtDate(r.firstCommit)}</td>
                    <td>{fmtDate(r.lastCommit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">Whole history of each repo; filters above do not apply to this table.</p>
        </section>
      </Breakdown>
    </>
  );
}
