import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, type Route } from '../src/router';

describe('routes', () => {
  it('parses every screen and falls back home', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('#/wake')).toEqual({ name: 'wake' });
    expect(parseRoute('#/talk/abc')).toEqual({ name: 'talk', id: 'abc' });
    expect(parseRoute('#/talk')).toEqual({ name: 'home' });
    expect(parseRoute('#/nowhere')).toEqual({ name: 'home' });
  });

  it('round-trips hashes, including awkward ids', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'settings' },
      { name: 'soul', id: 'a b/c' },
      { name: 'talk', id: '123' },
    ];
    for (const r of routes) expect(parseRoute(routeHash(r))).toEqual(r);
  });
});
