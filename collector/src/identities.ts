/**
 * Turns raw (name, email) pairs from git history into people.
 *
 *  1. Authors matching `ignoreAuthors` are dropped.
 *  2. Identities that share an email address are merged automatically.
 *  3. Identities listed together under one key in `identities` are merged and take that key as name.
 *  4. Everything left that merely looks alike is reported, never merged.
 */

export interface RawIdentity {
  name: string;
  email: string;
  commits: number;
}

export interface Person {
  id: string;
  name: string;
  members: RawIdentity[];
}

export interface Lookalike {
  a: Person;
  b: Person;
  reason: string;
}

export interface IdentityOptions {
  identities?: Record<string, string[]>;
  ignoreAuthors?: string[];
}

export interface IdentityResolution {
  people: Person[];
  ignored: RawIdentity[];
  lookalikes: Lookalike[];
  warnings: string[];
  personOf(name: string, email: string): Person | undefined;
}

const lower = (s: string) => s.trim().toLowerCase();

export const identityKey = (name: string, email: string) => `${name.trim()}\x1f${lower(email)}`;

function ignoreMatcher(patterns: string[]): (id: RawIdentity) => boolean {
  const tests = patterns
    .map(lower)
    .filter((p) => p !== '')
    .map((p) => {
      if (!p.includes('*')) return (v: string) => v === p;
      const re = new RegExp(`^${p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
      return (v: string) => re.test(v);
    });
  return (id) => tests.some((t) => t(lower(id.name)) || t(lower(id.email)));
}

export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'contributor';
}

const normName = (name: string) =>
  name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const nameTokens = (name: string) =>
  name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

const GENERIC_LOCAL_PARTS = new Set(['', 'info', 'admin', 'dev', 'developer', 'mail', 'me', 'git', 'github', 'noreply', 'no-reply', 'user', 'root', 'hello', 'contact', 'support', 'team']);

/** "12345+octo.cat@users.noreply.github.com" -> "octocat" */
function localPart(email: string): string {
  const local = lower(email).split('@')[0] ?? '';
  return local.replace(/^\d+\+/, '').replace(/[^a-z0-9]/g, '');
}

function lookalikeReason(a: Person, b: Person): string | null {
  const namesA = new Set(a.members.map((m) => normName(m.name)).concat(normName(a.name)).filter((n) => n.length >= 3));
  const namesB = new Set(b.members.map((m) => normName(m.name)).concat(normName(b.name)).filter((n) => n.length >= 3));
  for (const n of namesA) if (namesB.has(n)) return 'same name, different email';

  const localsA = new Set(a.members.map((m) => localPart(m.email)).filter((l) => l.length >= 3 && !GENERIC_LOCAL_PARTS.has(l)));
  const localsB = new Set(b.members.map((m) => localPart(m.email)).filter((l) => l.length >= 3 && !GENERIC_LOCAL_PARTS.has(l)));
  for (const l of localsA) if (localsB.has(l)) return 'same email user name on different domains';
  for (const l of localsA) if (namesB.has(l)) return 'email user name matches the other name';
  for (const l of localsB) if (namesA.has(l)) return 'email user name matches the other name';

  const tokensA = nameTokens(a.name);
  const tokensB = nameTokens(b.name);
  const [short, long] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  if (short.length > 0 && short.some((t) => t.length >= 3) && short.every((t) => long.includes(t))) {
    return 'one name is contained in the other';
  }
  return null;
}

export function resolveIdentities(raw: RawIdentity[], options: IdentityOptions = {}): IdentityResolution {
  const isIgnored = ignoreMatcher(options.ignoreAuthors ?? []);
  const ignored = raw.filter(isIgnored);
  const kept = raw.filter((id) => !isIgnored(id));
  const warnings: string[] = [];

  // Union-find over the kept identities.
  const parent = kept.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  // 1. Same email address => same person.
  const byEmail = new Map<string, number>();
  kept.forEach((id, i) => {
    const email = lower(id.email);
    if (!email) return;
    const seen = byEmail.get(email);
    if (seen === undefined) byEmail.set(email, i);
    else union(seen, i);
  });

  // 2. Explicit merges from the config. Aliases may be emails or author names.
  const configured: Array<{ label: string; index: number }> = [];
  for (const [label, aliases] of Object.entries(options.identities ?? {})) {
    const wanted = new Set([label, ...aliases].map(lower));
    const matches = kept.map((id, i) => (wanted.has(lower(id.email)) || wanted.has(lower(id.name)) ? i : -1)).filter((i) => i >= 0);
    if (matches.length === 0) continue;
    for (const i of matches) union(matches[0]!, i);
    configured.push({ label, index: matches[0]! });
  }
  const labels = new Map<number, string>();
  for (const { label, index } of configured) {
    const root = find(index);
    const existing = labels.get(root);
    if (existing && existing !== label) {
      warnings.push(`identities: "${existing}" and "${label}" share an author, so they were merged as "${existing}".`);
    } else {
      labels.set(root, label);
    }
  }

  // 3. Build people.
  const groups = new Map<number, RawIdentity[]>();
  kept.forEach((id, i) => {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(id);
    else groups.set(root, [id]);
  });

  const total = (members: RawIdentity[]) => members.reduce((n, m) => n + m.commits, 0);
  const drafts = [...groups.entries()].map(([root, members]) => {
    // Most-used name wins; on a tie prefer the fuller, capitalised spelling.
    members.sort((a, b) => b.commits - a.commits || b.name.length - a.name.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const name = labels.get(root) ?? members.find((m) => m.name)?.name ?? 'Unknown';
    return { name, members };
  });
  drafts.sort((a, b) => total(b.members) - total(a.members) || a.name.localeCompare(b.name));

  const usedIds = new Set<string>();
  const people: Person[] = drafts.map(({ name, members }) => {
    const base = slugify(name);
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    return { id, name, members };
  });

  const index = new Map<string, Person>();
  for (const person of people) for (const m of person.members) index.set(identityKey(m.name, m.email), person);

  const lookalikes: Lookalike[] = [];
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const reason = lookalikeReason(people[i]!, people[j]!);
      if (reason) lookalikes.push({ a: people[i]!, b: people[j]!, reason });
    }
  }

  return { people, ignored, lookalikes, warnings, personOf: (name, email) => index.get(identityKey(name, email)) };
}
