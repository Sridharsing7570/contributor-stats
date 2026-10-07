import { useEffect, useState } from 'react';
import { DEFAULT_FILTERS, type Filters } from './lib/aggregate';
import { loadStats, type LoadedStats } from './lib/data';
import { fmt, fmtDateTime } from './lib/format';
import { useRoute } from './lib/router';
import { ContributorPage } from './pages/ContributorPage';
import { Overview } from './pages/Overview';
import { NotFound, RepoPage } from './pages/RepoPage';

type Theme = 'light' | 'dark';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
    setTheme(next);
  };
  return [theme, toggle];
}

export function App() {
  const [loaded, setLoaded] = useState<LoadedStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [theme, toggleTheme] = useTheme();
  const route = useRoute();

  useEffect(() => {
    loadStats().then(setLoaded, (e: Error) => setError(e.message));
  }, []);

  const stats = loaded?.stats;
  const pageProps = stats ? { stats, filters, onFilters: setFilters } : null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/">Contributor stats</a>
          {stats && (
            <p className="collected">
              Collected {fmtDateTime(stats.generatedAt)} from {stats.repos.length} {stats.repos.length === 1 ? 'repo' : 'repos'} ·{' '}
              {fmt(stats.repos.reduce((n, r) => n + r.commits + r.mergeCommits, 0))} commits
            </p>
          )}
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </header>
      <main>
        {loaded?.isSample && (
          <p className="banner" role="status">
            Showing <strong>sample data</strong> with invented names. Run <code>npm run collect</code> to see your own repositories.
          </p>
        )}
        {error && <p className="banner error" role="alert">{error}</p>}
        {!loaded && !error && <p className="empty">Loading…</p>}
        {pageProps && route.page === 'overview' && <Overview {...pageProps} />}
        {pageProps && route.page === 'contributor' && <ContributorPage {...pageProps} id={route.id} />}
        {pageProps && route.page === 'repo' && <RepoPage {...pageProps} name={route.name} />}
        {pageProps && route.page === 'notfound' && <NotFound what="That page" />}
      </main>
    </>
  );
}
