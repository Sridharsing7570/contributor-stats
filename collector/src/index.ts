import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StatsAggregator } from './aggregate';
import { ConfigError, loadConfig } from './config';
import { assertGitRepo, GitError, readLog } from './git';
import { resolveIdentities, type Person } from './identities';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv: string[]) {
  const args = { config: path.join(ROOT, 'repos.config.json'), out: path.join(ROOT, 'web', 'public', 'data', 'stats.json') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: npm run collect -- [--config <repos.config.json>] [--out <stats.json>]');
      process.exit(0);
    }
    if ((arg === '--config' || arg === '--out') && argv[i + 1]) {
      // Relative paths are resolved from where the user ran npm, not from collector/.
      args[arg === '--config' ? 'config' : 'out'] = path.resolve(process.env.INIT_CWD ?? process.cwd(), argv[++i]!);
    } else {
      throw new ConfigError(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

const describe = (p: Person) => `${p.name} <${[...new Set(p.members.map((m) => m.email || '(no email)'))].join(', ')}>`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);

  // Check every path before doing any work, so one typo fails fast.
  for (const repo of config.repos) assertGitRepo(repo.name, repo.path);

  const aggregator = new StatsAggregator(config.excludePaths);
  for (const repo of config.repos) {
    aggregator.addRepo(repo.name);
    let commits = 0;
    let merges = 0;
    await readLog(repo.path, 'commits', (c) => (commits++, aggregator.addCommit(repo.name, c, false)));
    await readLog(repo.path, 'merges', (c) => (merges++, aggregator.addCommit(repo.name, c, true)));
    console.log(`  ${repo.name}: ${commits} commits, ${merges} merge commit${merges === 1 ? '' : 's'}`);
  }

  const resolution = resolveIdentities(aggregator.rawIdentities(), config);
  const stats = aggregator.build(resolution, new Date().toISOString());

  mkdirSync(path.dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(stats));

  console.log(`\n${stats.contributors.length} contributors across ${stats.repos.length} repos.`);
  if (resolution.ignored.length > 0) {
    console.log(`Ignored ${resolution.ignored.length} author identit${resolution.ignored.length === 1 ? 'y' : 'ies'} (ignoreAuthors).`);
  }
  for (const warning of resolution.warnings) console.warn(`Warning: ${warning}`);

  if (resolution.lookalikes.length > 0) {
    console.log(`\nPossible duplicates that were NOT merged (${resolution.lookalikes.length}).`);
    console.log('If two of these are the same person, list their emails under one name in "identities":\n');
    for (const { a, b, reason } of resolution.lookalikes) {
      console.log(`  - ${describe(a)}\n    ${describe(b)}\n    (${reason})`);
    }
  } else {
    console.log('\nNo unmerged look-alike identities found.');
  }
  const shown = path.relative(process.env.INIT_CWD ?? process.cwd(), args.out);
  console.log(`\nWrote ${shown.startsWith('..') ? args.out : shown}`);
}

main().catch((err) => {
  if (err instanceof ConfigError || err instanceof GitError) console.error(`\nError: ${err.message}`);
  else console.error(err);
  process.exit(1);
});
