/** Shape of web/public/data/stats.json. Keep in sync with web/src/types.ts. */

/** [date YYYY-MM-DD, commits, mergeCommits, added, deleted, addedFiltered, deletedFiltered] */
export type DailyRow = [string, number, number, number, number, number, number];

export interface TopFile {
  path: string;
  /** Number of non-merge commits that touched the file. */
  commits: number;
  added: number;
  deleted: number;
}

export interface ContributorRepoStats {
  commits: number;
  mergeCommits: number;
  filesTouched: number;
  filesTouchedFiltered: number;
  linesAdded: number;
  linesDeleted: number;
  linesAddedFiltered: number;
  linesDeletedFiltered: number;
  activeDays: number;
  firstCommit: string;
  lastCommit: string;
  topFiles: TopFile[];
  topFilesFiltered: TopFile[];
  daily: DailyRow[];
}

export interface Contributor {
  id: string;
  name: string;
  repos: Record<string, ContributorRepoStats>;
}

export interface RepoSummary {
  name: string;
  commits: number;
  mergeCommits: number;
  contributors: number;
  filesTouched: number;
  filesTouchedFiltered: number;
  firstCommit: string | null;
  lastCommit: string | null;
  topFiles: TopFile[];
  topFilesFiltered: TopFile[];
}

export interface Stats {
  schemaVersion: 1;
  generatedAt: string;
  /** True for the invented data set that ships with the repository. */
  sample?: boolean;
  excludePaths: string[];
  repos: RepoSummary[];
  contributors: Contributor[];
}
