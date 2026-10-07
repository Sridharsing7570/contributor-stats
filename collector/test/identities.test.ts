import { describe, expect, it } from 'vitest';
import { resolveIdentities, slugify, type RawIdentity } from '../src/identities';

const id = (name: string, email: string, commits = 1): RawIdentity => ({ name, email, commits });

describe('resolveIdentities', () => {
  it('merges identities that share an email, ignoring case', () => {
    const r = resolveIdentities([id('Asha Verma', 'asha@example.com', 10), id('asha', 'ASHA@Example.com', 2), id('Tomas', 'tomas@example.com')]);
    expect(r.people).toHaveLength(2);
    expect(r.people[0]).toMatchObject({ name: 'Asha Verma', id: 'asha-verma' });
    expect(r.people[0]!.members).toHaveLength(2);
    expect(r.personOf('asha', 'asha@EXAMPLE.com')?.id).toBe('asha-verma');
  });

  it('uses the name with the most commits for a merged person', () => {
    const r = resolveIdentities([id('av', 'asha@example.com', 1), id('Asha Verma', 'asha@example.com', 5)]);
    expect(r.people[0]!.name).toBe('Asha Verma');
  });

  it('does not merge different emails on its own', () => {
    const r = resolveIdentities([id('Manoj', 'manoj.150283@gmail.com'), id('Manoj', 'manojktechie@gmail.com')]);
    expect(r.people).toHaveLength(2);
    expect(r.people.map((p) => p.id)).toEqual(['manoj', 'manoj-2']);
  });

  it('merges emails listed under one name in the config and uses that name', () => {
    const r = resolveIdentities(
      [id('manoj', 'manoj.150283@gmail.com', 3), id('Manoj K', 'manojktechie@gmail.com', 9), id('Tomas', 'tomas@example.com')],
      { identities: { Manoj: ['manoj.150283@gmail.com', 'MANOJKTECHIE@gmail.com'] } },
    );
    expect(r.people).toHaveLength(2);
    expect(r.people[0]).toMatchObject({ name: 'Manoj', id: 'manoj' });
    expect(r.personOf('manoj', 'manoj.150283@gmail.com')).toBe(r.personOf('Manoj K', 'manojktechie@gmail.com'));
  });

  it('accepts author names as aliases and chains with the email rule', () => {
    const r = resolveIdentities(
      [id('lucia', 'lucia@work.example'), id('Lucia F.', 'lucia@home.example'), id('LF', 'lucia@home.example')],
      { identities: { 'Lucia Ferrante': ['lucia', 'Lucia F.'] } },
    );
    expect(r.people).toHaveLength(1);
    expect(r.people[0]!.name).toBe('Lucia Ferrante');
    expect(r.people[0]!.members).toHaveLength(3);
  });

  it('drops ignored authors by name, email or wildcard', () => {
    const r = resolveIdentities(
      [id('dependabot[bot]', '49699333+dependabot[bot]@users.noreply.github.com'), id('CI', 'ci@example.com'), id('Renovate', 'bot@renovate.example'), id('Asha', 'asha@example.com')],
      { ignoreAuthors: ['Dependabot[bot]', 'ci@example.com', '*@renovate.example'] },
    );
    expect(r.people.map((p) => p.name)).toEqual(['Asha']);
    expect(r.ignored).toHaveLength(3);
    expect(r.personOf('CI', 'ci@example.com')).toBeUndefined();
  });

  it('orders people by commits', () => {
    const r = resolveIdentities([id('Small', 's@example.com', 1), id('Big', 'b@example.com', 50)]);
    expect(r.people.map((p) => p.name)).toEqual(['Big', 'Small']);
  });

  it('warns when two config names claim the same author', () => {
    const r = resolveIdentities([id('x', 'x@example.com')], { identities: { One: ['x@example.com'], Two: ['x@example.com'] } });
    expect(r.people).toHaveLength(1);
    expect(r.warnings).toHaveLength(1);
  });
});

describe('look-alike report', () => {
  const reasons = (raw: RawIdentity[]) => resolveIdentities(raw).lookalikes.map((l) => l.reason);

  it('reports the same name with different emails', () => {
    expect(reasons([id('Manoj Kumar', 'a@example.com'), id('manoj  kumar', 'b@example.com')])).toEqual(['same name, different email']);
  });

  it('reports the same email user name on different domains', () => {
    expect(reasons([id('Mei', 'mei.nakagawa@work.example'), id('M N', '12345+meinakagawa@users.noreply.github.com')])).toHaveLength(1);
  });

  it('reports a name contained in a longer one', () => {
    expect(reasons([id('Kwame', 'k1@example.com'), id('Kwame Osei', 'k2@example.com')])).toEqual(['one name is contained in the other']);
  });

  it('stays quiet for unrelated people and for already merged ones', () => {
    expect(reasons([id('Asha Verma', 'asha@example.com'), id('Tomas Lindqvist', 'tomas@example.com')])).toEqual([]);
    expect(reasons([id('Asha', 'asha@example.com'), id('Asha', 'asha@example.com')])).toEqual([]);
  });
});

describe('slugify', () => {
  it('makes URL-safe ids', () => {
    expect(slugify('José Álvarez')).toBe('jose-alvarez');
    expect(slugify('***')).toBe('contributor');
  });
});
