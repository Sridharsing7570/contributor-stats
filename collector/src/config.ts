import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const DEFAULT_EXCLUDE_PATHS = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'dist/',
  'build/',
  'node_modules/',
  '*.min.js',
  '*.map',
];

export interface RepoEntry {
  name: string;
  path: string;
}

export interface CollectorConfig {
  repos: RepoEntry[];
  excludePaths: string[];
  identities: Record<string, string[]>;
  ignoreAuthors: string[];
}

export class ConfigError extends Error {}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Validates parsed JSON. `baseDir` is used to resolve relative repo paths. */
export function parseConfig(input: unknown, baseDir: string): CollectorConfig {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ConfigError('The config must be a JSON object with a "repos" array.');
  }
  const raw = input as Record<string, unknown>;

  if (!Array.isArray(raw.repos) || raw.repos.length === 0) {
    throw new ConfigError('"repos" must be a non-empty array of { "name", "path" } entries.');
  }
  const names = new Set<string>();
  const repos = raw.repos.map((entry, i): RepoEntry => {
    const e = entry as Record<string, unknown> | null;
    if (!e || typeof e.name !== 'string' || !e.name.trim() || typeof e.path !== 'string' || !e.path.trim()) {
      throw new ConfigError(`repos[${i}] needs a non-empty "name" and "path".`);
    }
    const name = e.name.trim();
    if (names.has(name)) throw new ConfigError(`Repo name "${name}" is used more than once; names must be unique.`);
    names.add(name);
    return { name, path: path.resolve(baseDir, e.path.trim()) };
  });

  if (raw.excludePaths !== undefined && !isStringArray(raw.excludePaths)) {
    throw new ConfigError('"excludePaths" must be an array of glob strings.');
  }
  if (raw.ignoreAuthors !== undefined && !isStringArray(raw.ignoreAuthors)) {
    throw new ConfigError('"ignoreAuthors" must be an array of names or emails.');
  }
  const identities: Record<string, string[]> = {};
  if (raw.identities !== undefined) {
    if (typeof raw.identities !== 'object' || raw.identities === null || Array.isArray(raw.identities)) {
      throw new ConfigError('"identities" must map a display name to an array of emails or names.');
    }
    for (const [name, aliases] of Object.entries(raw.identities)) {
      if (!isStringArray(aliases)) throw new ConfigError(`identities["${name}"] must be an array of emails or names.`);
      identities[name] = aliases;
    }
  }

  return {
    repos,
    excludePaths: raw.excludePaths ?? DEFAULT_EXCLUDE_PATHS,
    identities,
    ignoreAuthors: raw.ignoreAuthors ?? [],
  };
}

export function loadConfig(file: string): CollectorConfig {
  if (!existsSync(file)) {
    throw new ConfigError(`Config file not found: ${file}\nCopy repos.config.example.json to repos.config.json and list your repositories.`);
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (err) {
    throw new ConfigError(
      `${file} is not valid JSON: ${(err as Error).message}\nOn Windows, write paths with doubled backslashes ("C:\\\\code\\\\repo") or forward slashes ("C:/code/repo").`,
    );
  }
  return parseConfig(json, path.dirname(file));
}
