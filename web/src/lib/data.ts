import type { Stats } from '../types';

export interface LoadedStats {
  stats: Stats;
  /** True when stats.json was missing and the bundled sample is shown instead. */
  isSample: boolean;
}

async function fetchStats(file: string): Promise<Stats | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-store' });
    if (!res.ok) return null;
    // Dev servers answer missing files with index.html, so parse defensively.
    const data = JSON.parse(await res.text()) as Stats;
    return Array.isArray(data?.contributors) && Array.isArray(data?.repos) ? data : null;
  } catch {
    return null;
  }
}

export async function loadStats(): Promise<LoadedStats> {
  const real = await fetchStats('stats.json');
  if (real) return { stats: real, isSample: real.sample === true };
  const sample = await fetchStats('stats.sample.json');
  if (sample) return { stats: sample, isSample: true };
  throw new Error('No data found. Run "npm run collect" to create web/public/data/stats.json.');
}
