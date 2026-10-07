import { fmt } from '../lib/format';
import { repoHref } from '../lib/router';
import type { TopFile } from '../types';

export function StatTiles({ items }: { items: Array<{ label: string; value: string; note?: string }> }) {
  return (
    <dl className="tiles">
      {items.map((item) => (
        <div className="tile card" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.note && <span className="tile-note">{item.note}</span>}
        </div>
      ))}
    </dl>
  );
}

export function TopFilesTable({ files, showRepo = false }: { files: Array<TopFile & { repo?: string }>; showRepo?: boolean }) {
  if (files.length === 0) return <p className="empty">No file changes recorded.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>File</th>
            {showRepo && <th>Repo</th>}
            <th className="num">Commits</th>
            <th className="num">Added</th>
            <th className="num">Deleted</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={`${f.repo ?? ''}:${f.path}`}>
              <th scope="row" className="path">{f.path}</th>
              {showRepo && <td>{f.repo && <a href={repoHref(f.repo)}>{f.repo}</a>}</td>}
              <td className="num">{fmt(f.commits)}</td>
              <td className="num added">+{fmt(f.added)}</td>
              <td className="num deleted">−{fmt(f.deleted)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
