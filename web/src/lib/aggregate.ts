import type { Contributor, Stats, TopFile } from '../types';

export interface Filters {
  /** Selected repo names; null means all. */
  repos: string[] | null;
  /** Inclusive YYYY-MM-DD bounds; empty string means open. */
  from: string;
  to: string;
  excludeGenerated: boolean;
}

export const DEFAULT_FILTERS: Filters = { repos: null, from: '', to: '', excludeGenerated: true };

export interface Totals {
  commits: number;
  merges: number;
  added: number;
  deleted: number;
  files: number;
  activeDays: number;
  repos: number;
  first: string | null;
  last: string | null;
}

export interface ContributorRow extends Totals {
  id: string;
  name: string;
}

export const OTHERS = '__others';

const inRange = (date: string, f: Filters) => (!f.from || date >= f.from) && (!f.to || date <= f.to);
const repoSelected = (repo: string, f: Filters) => f.repos === null || f.repos.includes(repo);
export const hasDateFilter = (f: Filters) => f.from !== '' || f.to !== '';

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Totals for one contributor under the current filters. */
export function totalsFor(c: Contributor, f: Filters): Totals {
  const t: Totals = { commits: 0, merges: 0, added: 0, deleted: 0, files: 0, activeDays: 0, repos: 0, first: null, last: null };
  const days = new Set<string>();
  for (const [repo, rs] of Object.entries(c.repos)) {
    if (!repoSelected(repo, f)) continue;
    let active = false;
    for (const [date, commits, merges, added, deleted, addedF, deletedF] of rs.daily) {
      if (!inRange(date, f)) continue;
      active = true;
      t.commits += commits;
      t.merges += merges;
      t.added += f.excludeGenerated ? addedF : added;
      t.deleted += f.excludeGenerated ? deletedF : deleted;
      days.add(date);
      if (!t.first || date < t.first) t.first = date;
      if (!t.last || date > t.last) t.last = date;
    }
    if (active) {
      t.repos += 1;
      // File counts are only known for the whole history of a repo.
      t.files += f.excludeGenerated ? rs.filesTouchedFiltered : rs.filesTouched;
    }
  }
  t.activeDays = days.size;
  return t;
}

/** One row per contributor with any activity under the filters, most commits first. */
export function contributorRows(stats: Stats, f: Filters): ContributorRow[] {
  return stats.contributors
    .map((c) => ({ id: c.id, name: c.name, ...totalsFor(c, f) }))
    .filter((r) => r.commits + r.merges > 0)
    .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
}

export function sumRows(rows: Totals[]): Pick<Totals, 'commits' | 'merges' | 'added' | 'deleted'> {
  return rows.reduce(
    (t, r) => ({ commits: t.commits + r.commits, merges: t.merges + r.merges, added: t.added + r.added, deleted: t.deleted + r.deleted }),
    { commits: 0, merges: 0, added: 0, deleted: 0 },
  );
}

export type WeekPoint = { week: string } & Record<string, number | string>;

/**
 * Weekly commit counts (non-merge), one key per series. `seriesOf` names the
 * series a contributor/repo pair belongs to, or null to leave it out.
 * Weeks without commits are filled with zeros so lines do not skip them.
 */
export function weeklyCommits(
  stats: Stats,
  f: Filters,
  seriesOf: (contributorId: string, repo: string) => string | null,
): { data: WeekPoint[]; keys: string[] } {
  const weeks = new Map<string, Record<string, number>>();
  const keys = new Set<string>();
  for (const c of stats.contributors) {
    for (const [repo, rs] of Object.entries(c.repos)) {
      if (!repoSelected(repo, f)) continue;
      const key = seriesOf(c.id, repo);
      if (key === null) continue;
      for (const [date, commits] of rs.daily) {
        if (commits === 0 || !inRange(date, f)) continue;
        const week = weekStart(date);
        let bucket = weeks.get(week);
        if (!bucket) weeks.set(week, (bucket = {}));
        bucket[key] = (bucket[key] ?? 0) + commits;
        keys.add(key);
      }
    }
  }
  if (weeks.size === 0) return { data: [], keys: [] };
  const sorted = [...weeks.keys()].sort();
  const keyList = [...keys];
  const data: WeekPoint[] = [];
  for (let w = sorted[0]!; w <= sorted[sorted.length - 1]!; w = addDays(w, 7)) {
    const point: WeekPoint = { week: w };
    for (const k of keyList) point[k] = weeks.get(w)?.[k] ?? 0;
    data.push(point);
  }
  return { data, keys: keyList };
}

/** For each selected repo, each series' percentage of that repo's commits. */
export function repoShares(stats: Stats, f: Filters, seriesOf: (contributorId: string) => string): Array<Record<string, number | string>> {
  const out: Array<Record<string, number | string>> = [];
  for (const repo of stats.repos) {
    if (!repoSelected(repo.name, f)) continue;
    const counts: Record<string, number> = {};
    let total = 0;
    for (const c of stats.contributors) {
      const rs = c.repos[repo.name];
      if (!rs) continue;
      let n = 0;
      for (const [date, commits] of rs.daily) if (inRange(date, f)) n += commits;
      if (n === 0) continue;
      const key = seriesOf(c.id);
      counts[key] = (counts[key] ?? 0) + n;
      total += n;
    }
    if (total === 0) continue;
    const row: Record<string, number | string> = { repo: repo.name, total };
    for (const [k, n] of Object.entries(counts)) row[k] = (n / total) * 100;
    out.push(row);
  }
  return out;
}

export interface RepoFile extends TopFile {
  repo: string;
}

/** A contributor's most-edited files across the selected repos. */
export function topFilesFor(c: Contributor, f: Filters, limit = 10): RepoFile[] {
  return Object.entries(c.repos)
    .filter(([repo]) => repoSelected(repo, f))
    .flatMap(([repo, rs]) => (f.excludeGenerated ? rs.topFilesFiltered : rs.topFiles).map((file) => ({ ...file, repo })))
    .sort((a, b) => b.commits - a.commits || b.added + b.deleted - (a.added + a.deleted))
    .slice(0, limit);
}
