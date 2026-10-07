import { useEffect, useState } from 'react';

/** Hash routing keeps the site a plain static bundle: no server rewrites needed. */
export type Route = { page: 'overview' } | { page: 'contributor'; id: string } | { page: 'repo'; name: string } | { page: 'notfound' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { page: 'overview' };
  if (parts[0] === 'contributor' && parts[1]) return { page: 'contributor', id: parts[1] };
  if (parts[0] === 'repo' && parts[1]) return { page: 'repo', name: parts[1] };
  return { page: 'notfound' };
}

export const contributorHref = (id: string) => `#/contributor/${encodeURIComponent(id)}`;
export const repoHref = (name: string) => `#/repo/${encodeURIComponent(name)}`;

export function useRoute(): Route {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parseRoute(hash);
}
