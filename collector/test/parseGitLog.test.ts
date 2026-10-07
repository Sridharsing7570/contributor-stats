import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGitLog, resolveRenamedPath, unquotePath } from '../src/parseGitLog';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('parseGitLog', () => {
  const commits = parseGitLog(fixture('commits.log'));

  it('splits the log into commits with author and date', () => {
    expect(commits).toHaveLength(4);
    expect(commits[0]).toMatchObject({
      hash: '1'.repeat(40),
      name: 'Asha Verma',
      email: 'asha@example.com',
      date: '2025-03-04T10:15:00+05:30',
    });
  });

  it('reads added and deleted lines per file', () => {
    expect(commits[0]!.files).toEqual([
      { path: 'src/app.ts', added: 12, deleted: 3 },
      { path: 'package-lock.json', added: 400, deleted: 20 },
    ]);
  });

  it('skips binary files, which numstat reports as "-"', () => {
    expect(commits[0]!.files.map((f) => f.path)).not.toContain('assets/logo.png');
  });

  it('attributes renames to the new path', () => {
    expect(commits[1]!.files.map((f) => f.path)).toEqual([
      'src/new/util.ts',
      'README.md',
      'src/core/index.ts',
      'docs/café notes.md',
    ]);
  });

  it('keeps commits that have no file changes', () => {
    expect(commits[2]).toMatchObject({ hash: '3'.repeat(40), files: [] });
  });

  it('parses header-only output from the merge pass', () => {
    const merges = parseGitLog(fixture('merges.log'));
    expect(merges.map((m) => m.name)).toEqual(['Asha Verma', 'dependabot[bot]']);
    expect(merges.every((m) => m.files.length === 0)).toBe(true);
  });

  it('tolerates CRLF line endings and empty input', () => {
    expect(parseGitLog(fixture('commits.log').replace(/\n/g, '\r\n'))).toEqual(commits);
    expect(parseGitLog('')).toEqual([]);
  });
});

describe('path helpers', () => {
  it('resolves every rename form', () => {
    expect(resolveRenamedPath('a/{b => c}/d.ts')).toBe('a/c/d.ts');
    expect(resolveRenamedPath('a/{b => }/d.ts')).toBe('a/d.ts');
    expect(resolveRenamedPath('{ => pkg}/d.ts')).toBe('pkg/d.ts');
    expect(resolveRenamedPath('old.ts => new.ts')).toBe('new.ts');
    expect(resolveRenamedPath('plain/path.ts')).toBe('plain/path.ts');
  });

  it('unquotes paths git has escaped', () => {
    expect(unquotePath('"a\\tb.txt"')).toBe('a\tb.txt');
    expect(unquotePath('"caf\\303\\251.md"')).toBe('café.md');
    expect(unquotePath('normal.md')).toBe('normal.md');
  });
});
