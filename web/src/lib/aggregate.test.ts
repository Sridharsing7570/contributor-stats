import { describe, expect, it } from 'vitest';
import type { ContributorRepoStats, Stats } from '../types';
import { contributorRows, DEFAULT_FILTERS, repoShares, weeklyCommits, weekStart } from './aggregate';

const repo = (daily: ContributorRepoStats['daily']): ContributorRepoStats => ({
  commits: 0, mergeCommits: 0, filesTouched: 9, filesTouchedFiltered: 7, linesAdded: 0, linesDeleted: 0,
  linesAddedFiltered: 0, linesDeletedFiltered: 0, activeDays: daily.length, firstCommit: '', lastCommit: '',
  topFiles: [], topFilesFiltered: [], daily,
});
const summary = (name: string) => ({ name, commits: 0, mergeCommits: 0, contributors: 0, filesTouched: 0, filesTouchedFiltered: 0, firstCommit: null, lastCommit: null, topFiles: [], topFilesFiltered: [] });

const stats: Stats = {
  schemaVersion: 1,
  generatedAt: '2025-02-01T00:00:00Z',
  excludePaths: [],
  repos: [summary('a'), summary('b')],
  contributors: [
    { id: 'x', name: 'X', repos: { a: repo([['2025-01-06', 2, 0, 100, 10, 40, 5], ['2025-01-20', 1, 1, 10, 0, 10, 0]]), b: repo([['2025-01-06', 1, 0, 5, 5, 5, 5]]) } },
    { id: 'y', name: 'Y', repos: { a: repo([['2025-01-08', 1, 0, 1, 1, 1, 1]]) } },
  ],
};

describe('contributorRows', () => {
  it('sums across repos and counts a shared day once', () => {
    const [x] = contributorRows(stats, { ...DEFAULT_FILTERS, excludeGenerated: false });
    expect(x).toMatchObject({ id: 'x', commits: 4, merges: 1, added: 115, deleted: 15, repos: 2, activeDays: 2, files: 18, first: '2025-01-06', last: '2025-01-20' });
  });
  it('switches line counts with the exclude-generated toggle', () => {
    expect(contributorRows(stats, DEFAULT_FILTERS)[0]).toMatchObject({ added: 55, deleted: 10, files: 14 });
  });
  it('applies repo and date filters and drops inactive people', () => {
    const rows = contributorRows(stats, { ...DEFAULT_FILTERS, repos: ['a'], from: '2025-01-10', to: '2025-01-31' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'x', commits: 1, merges: 1, repos: 1 });
  });
});

describe('weekly series', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2025-01-12')).toBe('2025-01-06');
    expect(weekStart('2025-01-13')).toBe('2025-01-13');
  });
  it('fills empty weeks with zeros', () => {
    const { data } = weeklyCommits(stats, DEFAULT_FILTERS, (id) => id);
    expect(data).toEqual([
      { week: '2025-01-06', x: 3, y: 1 },
      { week: '2025-01-13', x: 0, y: 0 },
      { week: '2025-01-20', x: 1, y: 0 },
    ]);
  });
});

describe('repoShares', () => {
  it('gives each contributor a percentage of the repo commits', () => {
    expect(repoShares(stats, DEFAULT_FILTERS, (id) => id)).toEqual([
      { repo: 'a', total: 4, x: 75, y: 25 },
      { repo: 'b', total: 1, x: 100 },
    ]);
  });
});
