import { identityKey, type IdentityResolution, type RawIdentity } from './identities';
import type { RawCommit } from './parseGitLog';
import { createPathMatcher } from './paths';
import type { Contributor, ContributorRepoStats, DailyRow, RepoSummary, Stats, TopFile } from './types';

type Day = [commits: number, merges: number, added: number, deleted: number, addedF: number, deletedF: number];

interface FileAcc {
  commits: number;
  added: number;
  deleted: number;
}

interface Acc {
  commits: number;
  merges: number;
  first: string;
  last: string;
  files: Map<string, FileAcc>;
  daily: Map<string, Day>;
}

const TOP_FILES = 10;
const newAcc = (): Acc => ({ commits: 0, merges: 0, first: '', last: '', files: new Map(), daily: new Map() });

const earlier = (a: string, b: string) => (!a ? b : !b ? a : Date.parse(a) <= Date.parse(b) ? a : b);
const later = (a: string, b: string) => (!a ? b : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b);

function mergeInto(target: Acc, source: Acc): void {
  target.commits += source.commits;
  target.merges += source.merges;
  target.first = earlier(target.first, source.first);
  target.last = later(target.last, source.last);
  for (const [path, f] of source.files) {
    const t = target.files.get(path);
    if (t) {
      t.commits += f.commits;
      t.added += f.added;
      t.deleted += f.deleted;
    } else {
      target.files.set(path, { ...f });
    }
  }
  for (const [date, d] of source.daily) {
    const t = target.daily.get(date);
    if (t) d.forEach((v, i) => (t[i]! += v));
    else target.daily.set(date, [...d]);
  }
}

function topFiles(files: Map<string, FileAcc>, keep: (path: string) => boolean): TopFile[] {
  return [...files.entries()]
    .filter(([path]) => keep(path))
    .map(([path, f]) => ({ path, ...f }))
    .sort((a, b) => b.commits - a.commits || b.added + b.deleted - (a.added + a.deleted) || a.path.localeCompare(b.path))
    .slice(0, TOP_FILES);
}

/**
 * Accumulates commits per repo and raw identity. Identities are only resolved
 * into people in `build`, once every repo has been read.
 */
export class StatsAggregator {
  private readonly repos = new Map<string, Map<string, Acc>>();
  private readonly identities = new Map<string, RawIdentity>();
  private readonly isExcluded: (path: string) => boolean;

  constructor(private readonly excludePaths: string[]) {
    this.isExcluded = createPathMatcher(excludePaths);
  }

  addRepo(name: string): void {
    if (!this.repos.has(name)) this.repos.set(name, new Map());
  }

  addCommit(repo: string, commit: RawCommit, isMerge: boolean): void {
    this.addRepo(repo);
    const byIdentity = this.repos.get(repo)!;
    const key = identityKey(commit.name, commit.email);

    const identity = this.identities.get(key);
    if (identity) identity.commits += 1;
    else this.identities.set(key, { name: commit.name, email: commit.email, commits: 1 });

    let acc = byIdentity.get(key);
    if (!acc) byIdentity.set(key, (acc = newAcc()));

    acc.first = earlier(acc.first, commit.date);
    acc.last = later(acc.last, commit.date);

    // Days are bucketed in the author's own time zone, as recorded in the commit.
    const date = commit.date.slice(0, 10);
    let day = acc.daily.get(date);
    if (!day) acc.daily.set(date, (day = [0, 0, 0, 0, 0, 0]));

    if (isMerge) {
      acc.merges += 1;
      day[1] += 1;
      return;
    }

    acc.commits += 1;
    day[0] += 1;
    const seen = new Set<string>();
    for (const file of commit.files) {
      day[2] += file.added;
      day[3] += file.deleted;
      if (!this.isExcluded(file.path)) {
        day[4] += file.added;
        day[5] += file.deleted;
      }
      let f = acc.files.get(file.path);
      if (!f) acc.files.set(file.path, (f = { commits: 0, added: 0, deleted: 0 }));
      if (!seen.has(file.path)) {
        f.commits += 1;
        seen.add(file.path);
      }
      f.added += file.added;
      f.deleted += file.deleted;
    }
  }

  rawIdentities(): RawIdentity[] {
    return [...this.identities.values()];
  }

  build(resolution: IdentityResolution, generatedAt: string): Stats {
    const included = (path: string) => !this.isExcluded(path);
    const all = () => true;
    const contributors = new Map<string, Contributor>();
    const repos: RepoSummary[] = [];

    for (const [repoName, byIdentity] of this.repos) {
      const perPerson = new Map<string, Acc>();
      const repoAcc = newAcc();
      for (const [key, acc] of byIdentity) {
        const raw = this.identities.get(key)!;
        const person = resolution.personOf(raw.name, raw.email);
        if (!person) continue; // ignored author
        let merged = perPerson.get(person.id);
        if (!merged) perPerson.set(person.id, (merged = newAcc()));
        mergeInto(merged, acc);
        mergeInto(repoAcc, acc);
      }

      for (const person of resolution.people) {
        const acc = perPerson.get(person.id);
        if (!acc) continue;
        let contributor = contributors.get(person.id);
        if (!contributor) contributors.set(person.id, (contributor = { id: person.id, name: person.name, repos: {} }));
        contributor.repos[repoName] = toRepoStats(acc, included, all);
      }

      const paths = [...repoAcc.files.keys()];
      repos.push({
        name: repoName,
        commits: repoAcc.commits,
        mergeCommits: repoAcc.merges,
        contributors: perPerson.size,
        filesTouched: paths.length,
        filesTouchedFiltered: paths.filter(included).length,
        firstCommit: repoAcc.first || null,
        lastCommit: repoAcc.last || null,
        topFiles: topFiles(repoAcc.files, all),
        topFilesFiltered: topFiles(repoAcc.files, included),
      });
    }

    return {
      schemaVersion: 1,
      generatedAt,
      excludePaths: this.excludePaths,
      repos,
      // Same order as resolution.people: most commits first.
      contributors: resolution.people.map((p) => contributors.get(p.id)).filter((c): c is Contributor => !!c),
    };
  }
}

function toRepoStats(acc: Acc, included: (p: string) => boolean, all: (p: string) => boolean): ContributorRepoStats {
  const daily: DailyRow[] = [...acc.daily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => [date, ...d]);
  const sum = (i: number) => daily.reduce((n, row) => n + (row[i] as number), 0);
  const paths = [...acc.files.keys()];
  return {
    commits: acc.commits,
    mergeCommits: acc.merges,
    filesTouched: paths.length,
    filesTouchedFiltered: paths.filter(included).length,
    linesAdded: sum(3),
    linesDeleted: sum(4),
    linesAddedFiltered: sum(5),
    linesDeletedFiltered: sum(6),
    activeDays: daily.length,
    firstCommit: acc.first,
    lastCommit: acc.last,
    topFiles: topFiles(acc.files, all),
    topFilesFiltered: topFiles(acc.files, included),
    daily,
  };
}
