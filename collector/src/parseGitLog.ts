/**
 * Parser for `git log --numstat` output produced with LOG_FORMAT.
 *
 * Each commit starts with a header line:
 *   \x1e<hash>\x1f<author name>\x1f<author email>\x1f<ISO date>
 * followed by zero or more numstat lines:
 *   <added>\t<deleted>\t<path>
 */

export const RECORD_SEP = '\x1e';
export const FIELD_SEP = '\x1f';
export const LOG_FORMAT = '%x1e%H%x1f%aN%x1f%aE%x1f%aI';

export interface FileChange {
  path: string;
  added: number;
  deleted: number;
}

export interface RawCommit {
  hash: string;
  name: string;
  email: string;
  /** Strict ISO 8601 author date, e.g. 2025-03-04T10:15:00+05:30 */
  date: string;
  files: FileChange[];
}

const NUMSTAT = /^(\d+|-)\t(\d+|-)\t(.+)$/;

/** Undo git's C-style quoting of unusual paths ("a\tb", "\303\251.txt"). */
export function unquotePath(path: string): string {
  if (path.length < 2 || !path.startsWith('"') || !path.endsWith('"')) return path;
  const body = path.slice(1, -1);
  const bytes: number[] = [];
  const simple: Record<string, number> = { n: 10, t: 9, r: 13, a: 7, b: 8, f: 12, v: 11, '"': 34, '\\': 92 };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch !== '\\') {
      for (const b of Buffer.from(ch, 'utf8')) bytes.push(b);
      continue;
    }
    const next = body[i + 1] ?? '';
    const octal = /^[0-7]{3}/.exec(body.slice(i + 1));
    if (octal) {
      bytes.push(parseInt(octal[0], 8));
      i += 3;
    } else if (next in simple) {
      bytes.push(simple[next]!);
      i += 1;
    } else {
      bytes.push(92);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

/**
 * numstat reports renames as `old => new` or `dir/{old => new}/file`.
 * Statistics are attributed to the new path.
 */
export function resolveRenamedPath(path: string): string {
  const braced = /\{(.*?) => (.*?)\}/;
  if (braced.test(path)) {
    return path.replace(braced, '$2').replace(/\/{2,}/g, '/').replace(/^\//, '');
  }
  const arrow = path.indexOf(' => ');
  return arrow === -1 ? path : path.slice(arrow + 4);
}

export interface LogParser {
  /** Feed one line of output (without the trailing newline). */
  line(line: string): void;
  /** Flush the last commit. */
  end(): void;
}

export function createLogParser(onCommit: (commit: RawCommit) => void): LogParser {
  let current: RawCommit | null = null;
  const flush = () => {
    if (current) onCommit(current);
    current = null;
  };
  return {
    line(raw) {
      const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
      if (line.startsWith(RECORD_SEP)) {
        flush();
        const [hash = '', name = '', email = '', date = ''] = line.slice(1).split(FIELD_SEP);
        current = { hash, name: name.trim(), email: email.trim(), date, files: [] };
        return;
      }
      if (!current || line === '') return;
      const m = NUMSTAT.exec(line);
      if (!m) return;
      // Binary files are reported as "-\t-\tpath": no line counts, so skip them.
      if (m[1] === '-' || m[2] === '-') return;
      current.files.push({
        path: resolveRenamedPath(unquotePath(m[3]!)),
        added: Number(m[1]),
        deleted: Number(m[2]),
      });
    },
    end: flush,
  };
}

/** Convenience wrapper for whole strings (used by tests). */
export function parseGitLog(text: string): RawCommit[] {
  const commits: RawCommit[] = [];
  const parser = createLogParser((c) => commits.push(c));
  for (const line of text.split('\n')) parser.line(line);
  parser.end();
  return commits;
}
