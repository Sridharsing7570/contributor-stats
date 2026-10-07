import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createLogParser, LOG_FORMAT, type RawCommit } from './parseGitLog';

export class GitError extends Error {}

/** Throws a readable error unless `repoPath` is a git repository. */
export function assertGitRepo(name: string, repoPath: string): void {
  if (!existsSync(repoPath) || !statSync(repoPath).isDirectory()) {
    throw new GitError(`Repo "${name}": ${repoPath} does not exist or is not a directory.`);
  }
  const result = spawnSync('git', ['-C', repoPath, 'rev-parse', '--git-dir'], { encoding: 'utf8' });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    throw new GitError(code === 'ENOENT' ? 'git was not found on PATH. Install git and try again.' : `Could not run git: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new GitError(`Repo "${name}": ${repoPath} is not a git repository.`);
  }
}

/**
 * Streams `git log` and calls `onCommit` for each commit. No shell is involved,
 * so Windows paths and paths with spaces are passed through untouched.
 */
export function readLog(repoPath: string, kind: 'commits' | 'merges', onCommit: (c: RawCommit) => void): Promise<void> {
  const args = [
    '-c', 'core.quotepath=off',
    '-C', repoPath,
    'log',
    '--exclude=refs/stash', // stashes are not real history
    '--all',
    ...(kind === 'commits' ? ['--no-merges', '--numstat'] : ['--merges']),
    `--pretty=format:${LOG_FORMAT}`,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const parser = createLogParser(onCommit);
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    const lines = createInterface({ input: child.stdout.setEncoding('utf8'), crlfDelay: Infinity });
    lines.on('line', (line) => parser.line(line));
    child.on('error', (err) => reject(new GitError(`Could not run git: ${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) return reject(new GitError(`git log failed in ${repoPath}:\n${stderr.trim()}`));
      parser.end();
      resolve();
    });
  });
}
