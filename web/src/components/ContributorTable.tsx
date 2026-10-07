import { useMemo, useState } from 'react';
import type { ContributorRow } from '../lib/aggregate';
import { fmt, fmtDate } from '../lib/format';
import { contributorHref } from '../lib/router';

type Key = 'name' | 'repos' | 'commits' | 'merges' | 'files' | 'added' | 'deleted' | 'activeDays' | 'first' | 'last';

const COLUMNS: Array<{ key: Key; label: string; numeric?: boolean; title?: string }> = [
  { key: 'name', label: 'Contributor' },
  { key: 'repos', label: 'Repos', numeric: true },
  { key: 'commits', label: 'Commits', numeric: true, title: 'Commits, not counting merges' },
  { key: 'merges', label: 'Merges', numeric: true, title: 'Merge commits' },
  { key: 'files', label: 'Files', numeric: true, title: 'Unique files touched' },
  { key: 'added', label: 'Added', numeric: true, title: 'Lines added' },
  { key: 'deleted', label: 'Deleted', numeric: true, title: 'Lines deleted' },
  { key: 'activeDays', label: 'Active days', numeric: true, title: 'Days with at least one commit' },
  { key: 'first', label: 'First commit' },
  { key: 'last', label: 'Last commit' },
];

interface Props {
  rows: ContributorRow[];
  showRepos?: boolean;
  /** Shown when a date range is active: file counts cover the whole history. */
  filesAreAllTime?: boolean;
}

export function ContributorTable({ rows, showRepos = true, filesAreAllTime = false }: Props) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'commits', dir: -1 });
  const columns = COLUMNS.filter((c) => showRepos || c.key !== 'repos');

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    return [...rows].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return cmp * dir || a.name.localeCompare(b.name);
    });
  }, [rows, sort]);

  const onSort = (key: Key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }));

  if (rows.length === 0) return <p className="empty">No commits match these filters.</p>;

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.numeric ? 'num' : undefined} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => onSort(c.key)} title={c.title}>
                    {c.label}
                    {c.key === 'files' && filesAreAllTime ? '*' : ''}
                    <span className="sort-mark" aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <th scope="row"><a href={contributorHref(r.id)}>{r.name}</a></th>
                {showRepos && <td className="num">{r.repos}</td>}
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
      {filesAreAllTime && <p className="footnote">* File counts cover the whole history of each repo, not just the selected dates.</p>}
    </>
  );
}
