import { describe, expect, it, vi } from 'vitest';
import { Navigation, asksForNewSong, isLandingAddress, navigationState, readRoute, routeSearch, type Route } from '../../src/app/navigation';
import { bundledRef } from '../../src/app/songRef';
import { songSlug } from '../../src/app/songLink';

const path = './songs/bass/songs/07-a-dawning.txt';
describe('routes', () => {
  it('shows the landing page for an address without a route', () => {
    expect(isLandingAddress('')).toBe(true);
    expect(isLandingAddress('?utm_source=x')).toBe(true);
    expect(isLandingAddress('?welcome&view=library')).toBe(true);
    expect(isLandingAddress('?view=library&kind=songs')).toBe(false);
    expect(isLandingAddress('?song=bass/ode-to-joy')).toBe(false);
  });
  it('opens the practice screen without a song link when no bundled song is picked', () => {
    for (const picked of ['', null]) {
      const query = new URLSearchParams(routeSearch('?song=bass/a-dawning&version=solo', { screen: 'practice', picked, version: null }));
      expect(query.get('view')).toBe('practice');
      expect(query.has('song')).toBe(false);
    }
  });
  it('round trips bundled versions and preserves unrelated query parameters', () => {
    const route: Route = { screen: 'practice', picked: 'demo:' + path, version: 'solo-bass' };
    const search = routeSearch('?kind=songs&instrument=guitar&extra=keep', route);
    expect(readRoute(search, [path])).toEqual(route);
    expect(new URLSearchParams(search).get('extra')).toBe('keep');
    expect(new URLSearchParams(search).has('instrument')).toBe(false);
  });
  it('keeps local song identities in history and out of shareable URLs', () => {
    const route: Route = { screen: 'practice', picked: 'lib:Private song', version: null };
    const search = routeSearch('?song=bass/a-dawning&version=solo', route);
    expect(search).toBe('view=practice'); expect(readRoute(search, [], route.picked)).toEqual(route);
    expect(readRoute(search, []).screen).toBe('practice');
  });
  it('reads a request for a new song and drops it from every later URL', () => {
    expect(asksForNewSong('?view=library&kind=mine&new=1')).toBe(true);
    expect(asksForNewSong('?view=library&kind=mine')).toBe(false);
    const routes: Route[] = [{ screen: 'library', kind: 'mine', family: null }, { screen: 'practice', picked: null, version: null }, { screen: 'jam', groove: 'blues-shuffle', setup: {} }];
    for (const route of routes) expect(asksForNewSong(routeSearch('?view=library&kind=mine&new=1', route))).toBe(false);
  });
  it('round trips the jam screen and drops song and library parameters', () => {
    const route: Route = { screen: 'jam', groove: 'blues-shuffle', setup: {} };
    const search = routeSearch('?song=bass/a-dawning&version=solo&kind=songs&instrument=guitar&extra=keep', route);
    expect(search).toBe('extra=keep&view=jam&groove=blues-shuffle');
    expect(readRoute(search, [path])).toEqual(route);
    expect(readRoute('?view=jam', [path])).toEqual({ screen: 'jam', groove: '', setup: {} });
  });
  it('carries the jam setup in the address', () => {
    const route: Route = { screen: 'jam', groove: 'funk-sixteenths', setup: { key: 'F#', tempo: 96, progression: 'one-chord', swing: 58 } };
    const search = routeSearch('?view=jam&groove=blues-shuffle&key=A&extra=keep', route);
    expect(search).toBe('view=jam&groove=funk-sixteenths&key=F%23&extra=keep&tempo=96&progression=one-chord&swing=58');
    expect(readRoute(search, [path])).toEqual(route);
  });
  it('reads only setup values of the right kind', () => {
    expect(readRoute('?view=jam&groove=x&key=Q&tempo=fast&swing=&progression=nope', [])).toEqual({ screen: 'jam', groove: 'x', setup: { key: 'Q', progression: 'nope' } });
  });
  it('leaves the groove out of other screens', () => {
    expect(new URLSearchParams(routeSearch('?view=jam&groove=blues-shuffle', { screen: 'library', kind: 'songs', family: null })).has('groove')).toBe(false);
    expect(routeSearch('?view=jam&groove=blues-shuffle&key=E&tempo=96&progression=one-chord&swing=58', { screen: 'library', kind: 'songs', family: null })).toBe('view=library&kind=songs');
    expect(routeSearch('?view=jam&groove=blues-shuffle', { screen: 'practice', picked: 'demo:' + path, version: null })).toBe('song=bass/a-dawning');
  });
  it('normalizes unknown library categories and instruments', () => {
    expect(readRoute('?kind=unknown&instrument=piano', [])).toEqual({ screen: 'library', kind: 'exercises', family: null });
    expect(navigationState({ app: 'tabtrainer', index: 1.5, picked: '' })).toBeNull();
  });
});
describe('navigation history', () => {
  function browser() {
    const location = { pathname: '/tabtrainer/', search: '', hash: '#score' };
    const history = {
      state: { app: 'tabtrainer', index: 0, picked: '' },
      pushState: vi.fn((state, _unused, url) => { history.state = state; ({ pathname: location.pathname, search: location.search } = new URL(url, 'https://example.com')); }),
      replaceState: vi.fn((state, _unused, url) => { history.state = state; ({ pathname: location.pathname, search: location.search } = new URL(url, 'https://example.com')); }),
      go: vi.fn(),
    };
    return { history, location, navigation: new Navigation(history, location, [path], '/tabtrainer/') };
  }
  it('pushes each distinct visit once and retains the URL hash', () => {
    const { history, navigation } = browser(); const route: Route = { screen: 'practice', picked: 'lib:A', version: null };
    navigation.show(route, 'lib:A', true); navigation.show(route, 'lib:A', true);
    expect(history.pushState).toHaveBeenCalledOnce(); expect(history.replaceState).toHaveBeenCalledOnce();
    expect(history.state.index).toBe(1); expect(history.pushState.mock.calls[0][2]).toBe('/tabtrainer/?view=practice#score');
    navigation.show({ ...route, picked: 'lib:B' }, 'lib:B', true); expect(history.state.index).toBe(2);
  });
  it('gives a bundled song its own path and reads the route back from it', () => {
    const { history, location, navigation } = browser();
    navigation.show({ screen: 'practice', picked: bundledRef(path), version: 'easy' }, bundledRef(path), true);
    expect(history.pushState.mock.calls[0][2]).toBe(`/tabtrainer/${songSlug(path)}/?version=easy#score`);
    expect(location.search).toBe('?version=easy');
    const open = vi.fn(); navigation.visit({ app: 'tabtrainer', index: 0, picked: '' }, open);
    expect(open.mock.calls[0][0]).toEqual({ screen: 'practice', picked: bundledRef(path), version: 'easy' });
  });
  it('restores the prior position after cancellation without reopening it', () => {
    const { history, location, navigation } = browser();
    navigation.show({ screen: 'practice', picked: 'lib:A', version: null }, 'lib:A', true);
    history.state = { app: 'tabtrainer', index: 0, picked: '' }; location.search = '?view=library';
    navigation.visit(history.state, (_route, _accept, cancel) => cancel());
    expect(history.go).toHaveBeenCalledWith(1);
    const open = vi.fn(); navigation.visit({ app: 'tabtrainer', index: 1, picked: 'lib:A' }, open); expect(open).not.toHaveBeenCalled();
  });
  it('ignores the answer to a visit once a later visit has been handled', () => {
    const { history, location, navigation } = browser();
    navigation.show({ screen: 'practice', picked: 'lib:A', version: null }, 'lib:A', true);
    navigation.show({ screen: 'practice', picked: 'lib:B', version: null }, 'lib:B', true);
    history.state = { app: 'tabtrainer', index: 1, picked: 'lib:A' }; location.search = '?view=practice';
    let first: { accept: (then?: () => void) => void; cancel: () => void } = { accept: () => {}, cancel: () => {} };
    navigation.visit(history.state, (_route, accept, cancel) => { first = { accept, cancel }; });
    history.state = { app: 'tabtrainer', index: 0, picked: '' }; location.search = '?view=library';
    navigation.visit(history.state, (_route, _accept, cancel) => cancel());
    expect(history.go).toHaveBeenCalledWith(2);
    const opened = vi.fn();
    first.cancel(); first.accept(opened);
    expect(history.go).toHaveBeenCalledOnce(); expect(opened).not.toHaveBeenCalled();
  });
  it('adopts an accepted history position before replacing its URL', () => {
    const { history, location, navigation } = browser();
    navigation.show({ screen: 'practice', picked: 'lib:A', version: null }, 'lib:A', true);
    history.state = { app: 'tabtrainer', index: 0, picked: '' }; location.search = '?view=library';
    navigation.visit(history.state, (route, accept) => { accept(); navigation.show(route, 'lib:A'); });
    expect(history.state.index).toBe(0);
  });
});
