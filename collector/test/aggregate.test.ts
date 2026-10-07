import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { StatsAggregator } from '../src/aggregate';
import { DEFAULT_EXCLUDE_PATHS, parseConfig } from '../src/config';
import { resolveIdentities } from '../src/identities';
import { parseGitLog } from '../src/parseGitLog';
import { createPathMatcher } from '../src/paths';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

function build() {
  const agg = new StatsAggregator(DEFAULT_EXCLUDE_PATHS);
  for (const c of parseGitLog(fixture('commits.log'))) agg.addCommit('web', c, false);
  for (const c of parseGitLog(fixture('merges.log'))) agg.addCommit('web', c, true);
  agg.addRepo('empty');
  const resolution = resolveIdentities(agg.rawIdentities(), { ignoreAuthors: ['dependabot[bot]'] });
  return agg.build(resolution, '2025-04-01T00:00:00.000Z');
}

describe('StatsAggregator', () => {
  const stats = build();
  const asha = stats.contributors.find((c) => c.name === 'Asha Verma')!.repos.web!;
  const tomas = stats.contributors.find((c) => c.name === 'Tomas Lindqvist')!.repos.web!;

  it('merges same-email identities and drops ignored authors', () => {
    expect(stats.contributors.map((c) => c.name).sort()).toEqual(['Asha Verma', 'Tomas Lindqvist']);
  });

  it('counts commits and merge commits separately', () => {
    expect(asha).toMatchObject({ commits: 2, mergeCommits: 1 });
    expect(tomas).toMatchObject({ commits: 2, mergeCommits: 0 });
  });

  it('counts lines with and without excluded paths', () => {
    expect(asha).toMatchObject({ linesAdded: 426, linesDeleted: 29, linesAddedFiltered: 26, linesDeletedFiltered: 9 });
    expect(tomas).toMatchObject({ linesAdded: 34, linesDeleted: 1, linesAddedFiltered: 1, linesDeletedFiltered: 1 });
  });

  it('counts unique files, active days and first/last commit', () => {
    expect(asha).toMatchObject({ filesTouched: 6, filesTouchedFiltered: 5, activeDays: 3 });
    expect(asha.firstCommit).toBe('2025-03-04T10:15:00+05:30');
    expect(asha.lastCommit).toBe('2025-03-08T12:00:00+05:30');
  });

  it('buckets activity by the author-local day', () => {
    expect(asha.daily).toEqual([
      ['2025-03-04', 1, 0, 412, 23, 12, 3],
      ['2025-03-05', 1, 0, 14, 6, 14, 6],
      ['2025-03-08', 0, 1, 0, 0, 0, 0],
    ]);
  });

  it('lists top files, with a variant that leaves out generated files', () => {
    expect(tomas.topFiles.map((f) => f.path)).toEqual(['dist/bundle.js', 'vendor/lib.min.js', 'src/app.ts']);
    expect(tomas.topFilesFiltered.map((f) => f.path)).toEqual(['src/app.ts']);
  });

  it('summarises each repo, including ones without commits', () => {
    const web = stats.repos.find((r) => r.name === 'web')!;
    expect(web).toMatchObject({ commits: 4, mergeCommits: 1, contributors: 2 });
    expect(web.topFiles[0]).toMatchObject({ path: 'src/app.ts', commits: 2 });
    expect(stats.repos.find((r) => r.name === 'empty')).toMatchObject({ commits: 0, contributors: 0, firstCommit: null });
  });

  it('never writes email addresses to the output', () => {
    expect(JSON.stringify(stats)).not.toContain('@');
  });
});

describe('excludePaths matcher', () => {
  const excluded = createPathMatcher(DEFAULT_EXCLUDE_PATHS);
  it.each(['package-lock.json', 'apps/web/package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'dist/a.js', 'pkg/dist/a/b.js', 'node_modules/x/index.js', 'a/build/out.css', 'vendor/jquery.min.js', 'out/app.js.map'])('excludes %s', (p) => {
    expect(excluded(p)).toBe(true);
  });
  it.each(['src/app.ts', 'src/distance.ts', 'builder/index.ts', 'docs/map.md', 'package.json'])('keeps %s', (p) => {
    expect(excluded(p)).toBe(false);
  });
  it('anchors patterns that contain a slash', () => {
    const m = createPathMatcher(['docs/api/**', 'gen/*.ts']);
    expect(m('docs/api/v1/index.html')).toBe(true);
    expect(m('x/docs/api/index.html')).toBe(false);
    expect(m('gen/types.ts')).toBe(true);
    expect(m('gen/deep/types.ts')).toBe(false);
  });
});

describe('parseConfig', () => {
  it('applies defaults and keeps Windows paths intact', () => {
    const c = parseConfig({ repos: [{ name: 'a', path: 'C:\\code\\a' }] }, '/base');
    expect(c.excludePaths).toEqual(DEFAULT_EXCLUDE_PATHS);
    expect(c.repos[0]!.path).toContain('code');
    expect(c.ignoreAuthors).toEqual([]);
  });
  it('rejects bad input with a readable message', () => {
    expect(() => parseConfig({ repos: [] }, '/')).toThrow(/non-empty/);
    expect(() => parseConfig({ repos: [{ name: 'a', path: '/a' }, { name: 'a', path: '/b' }] }, '/')).toThrow(/more than once/);
    expect(() => parseConfig({ repos: [{ name: 'a' }] }, '/')).toThrow(/repos\[0\]/);
  });
});
