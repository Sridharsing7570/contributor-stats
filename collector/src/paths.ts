/**
 * Small gitignore-flavoured glob matcher for `excludePaths`.
 *  - "dist/"            a directory with that name, at any depth
 *  - "*.min.js"         no slash: matched against the file name, at any depth
 *  - "docs/api/**"      contains a slash: matched against the whole path from the repo root
 */

function globToRegex(glob: string): string {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          out += '(?:.*/)?';
        } else {
          out += '.*';
        }
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return out;
}

export function patternToRegex(pattern: string): RegExp {
  const p = pattern.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (p.endsWith('/')) {
    const dir = globToRegex(p.slice(0, -1).replace(/^\//, ''));
    return p.slice(0, -1).includes('/') ? new RegExp(`^${dir}/`) : new RegExp(`(?:^|/)${dir}/`);
  }
  if (!p.includes('/')) return new RegExp(`(?:^|/)${globToRegex(p)}$`);
  return new RegExp(`^${globToRegex(p.replace(/^\//, ''))}$`);
}

export function createPathMatcher(patterns: string[]): (path: string) => boolean {
  const regexes = patterns.filter((p) => p.trim() !== '').map(patternToRegex);
  const cache = new Map<string, boolean>();
  return (path) => {
    let hit = cache.get(path);
    if (hit === undefined) {
      hit = regexes.some((r) => r.test(path));
      cache.set(path, hit);
    }
    return hit;
  };
}
