/**
 * Generates web/public/data/stats.sample.json: invented people and repositories,
 * pushed through the real aggregation code so the sample always matches the schema.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StatsAggregator } from './aggregate';
import { DEFAULT_EXCLUDE_PATHS } from './config';
import { resolveIdentities } from './identities';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const END = Date.UTC(2026, 8, 30);
const DAYS = 540;

// Deterministic PRNG so the file does not change between runs.
let seed = 20260930;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)]!;

const people = [
  { name: 'Asha Verma', email: 'asha@example.com', rate: 0.55, from: 0, merges: 0.2 },
  { name: 'Tomas Lindqvist', email: 'tomas@example.com', rate: 0.42, from: 0, merges: 0.12 },
  { name: 'Mei Nakagawa', email: 'mei@example.com', rate: 0.36, from: 60, merges: 0.05 },
  { name: 'Kwame Osei', email: 'kwame@example.com', rate: 0.3, from: 150, merges: 0.08 },
  { name: 'Lucia Ferrante', email: 'lucia@example.com', rate: 0.22, from: 0, merges: 0.02 },
  { name: 'Devika Rao', email: 'devika@example.com', rate: 0.2, from: 260, merges: 0.03 },
  { name: 'Jonas Becker', email: 'jonas@example.com', rate: 0.12, from: 330, merges: 0 },
  { name: 'Noor Haddad', email: 'noor@example.com', rate: 0.08, from: 400, merges: 0 },
];

const repos: Record<string, { weight: number[]; files: string[] }> = {
  storefront: {
    weight: [5, 2, 4, 1, 3, 2, 1, 1],
    files: ['src/App.tsx', 'src/pages/Cart.tsx', 'src/pages/Checkout.tsx', 'src/pages/Product.tsx', 'src/components/Header.tsx', 'src/components/PriceTag.tsx', 'src/hooks/useCart.ts', 'src/styles/theme.css', 'src/api/client.ts', 'README.md', 'package.json', 'package-lock.json', 'dist/assets/index.js', 'public/vendor/chart.min.js'],
  },
  'payments-api': {
    weight: [3, 5, 1, 4, 0, 2, 1, 0],
    files: ['src/server.ts', 'src/routes/charges.ts', 'src/routes/refunds.ts', 'src/routes/webhooks.ts', 'src/services/ledger.ts', 'src/services/fraud.ts', 'src/db/schema.sql', 'src/db/migrate.ts', 'test/charges.test.ts', 'test/ledger.test.ts', 'docs/api.md', 'pnpm-lock.yaml', 'package.json'],
  },
  'mobile-app': {
    weight: [1, 0, 3, 2, 4, 1, 2, 1],
    files: ['app/index.tsx', 'app/screens/Home.tsx', 'app/screens/Orders.tsx', 'app/screens/Settings.tsx', 'app/navigation.tsx', 'app/store/session.ts', 'app/theme.ts', 'ios/Podfile', 'android/app/build.gradle', 'yarn.lock', 'app.json'],
  },
};

const aggregator = new StatsAggregator(DEFAULT_EXCLUDE_PATHS);
let n = 0;
for (let d = 0; d < DAYS; d++) {
  const time = END - (DAYS - d) * 86400000;
  const weekday = new Date(time).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  people.forEach((person, pi) => {
    if (d < person.from) return;
    for (const [repoName, repo] of Object.entries(repos)) {
      const p = person.rate * (repo.weight[pi]! / 6) * (weekend ? 0.15 : 1) * (0.7 + 0.6 * Math.sin(d / 40 + pi) ** 2);
      let commits = rand() < p ? 1 + Math.floor(rand() * 3 * p) : 0;
      while (commits-- > 0) {
        const date = new Date(time + (9 + Math.floor(rand() * 9)) * 3600000 + Math.floor(rand() * 3600) * 1000).toISOString().replace('.000Z', '+00:00');
        const commit = { hash: (n++).toString(16).padStart(40, '0'), name: person.name, email: person.email, date, files: [] as { path: string; added: number; deleted: number }[] };
        if (rand() < person.merges) {
          aggregator.addCommit(repoName, commit, true);
          continue;
        }
        const count = 1 + Math.floor(rand() * rand() * 5);
        const paths = new Set<string>();
        // Earlier files in the list are edited more often.
        while (paths.size < count) paths.add(repo.files[Math.floor(rand() * rand() * repo.files.length)]!);
        if (rand() < 0.07) paths.add(pick(repo.files.filter((f) => /lock|dist\/|\.min\.js/.test(f))));
        for (const file of paths) {
          const generated = /lock|dist\/|\.min\.js/.test(file);
          const added = Math.floor(rand() * rand() * (generated ? 900 : 90)) + 1;
          commit.files.push({ path: file, added, deleted: Math.floor(added * rand() * 0.8) });
        }
        aggregator.addCommit(repoName, commit, false);
      }
    }
  });
}

const stats = aggregator.build(resolveIdentities(aggregator.rawIdentities()), new Date(END).toISOString());
stats.sample = true;
const out = path.join(ROOT, 'web', 'public', 'data', 'stats.sample.json');
writeFileSync(out, JSON.stringify(stats));
console.log(`Wrote ${path.relative(process.cwd(), out)} (${stats.contributors.length} invented contributors)`);
