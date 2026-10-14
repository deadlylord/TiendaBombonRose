import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoreNavigation, type NavigationBrowser } from '../services/storeNavigation';
import { orderCategories, isMensCategory } from '../services/categoryOrder';

function fakeBrowser(path = '/', top = 0) {
  const entries = [{ path, state: null as NavigationBrowser['history']['state'] }];
  let index = 0;
  let scrollY = top;
  let nextFrame = 1;
  const frames = new Map<number, FrameRequestCallback>();
  const listeners = new Set<() => void>();
  const browser: NavigationBrowser = {
    history: {
      get state() { return entries[index].state; },
      scrollRestoration: 'auto',
      pushState(state, _title, path) { entries.splice(index + 1); entries.push({ path, state }); index++; },
      replaceState(state, _title, path) { entries[index] = { path: path ?? entries[index].path, state }; },
      back() { if (index > 0) { index--; listeners.forEach(listener => listener()); } },
    },
    location: { get pathname() { return entries[index].path; } },
    get scrollY() { return scrollY; },
    scrollTo(options) { scrollY = options.top ?? 0; },
    requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener(_type, listener) { listeners.add(listener); },
    removeEventListener(_type, listener) { listeners.delete(listener); },
  };
  const flushFrames = () => {
    while (frames.size) { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback(0)); }
  };
  return { browser, entries, flushFrames, listeners };
}

test('Women categories precede men; each group remains alphabetically ordered', () => {
  assert.deepEqual(orderCategories(['Camisas Hombre', 'Vestidos', 'Blusas', 'Camisetas', 'Faldas', 'Blusas']), ['Blusas', 'Faldas', 'Vestidos', 'Camisas Hombre', 'Camisetas']);
});
test('Explicit women labels take precedence over garment names; whole words avoid false matches', () => {
  assert.equal(isMensCategory('Camisetas Mujer'), false);
  assert.equal(isMensCategory('Camisas dama'), false);
  assert.equal(isMensCategory('Complementos'), false);
  assert.equal(isMensCategory('Women'), false);
  assert.equal(isMensCategory('Pantalón hombre'), true);
  assert.equal(isMensCategory('Street Legends'), true);
});
test('Closing a product returns to search and its exact scroll without creating another entry', () => {
  const { browser, entries, flushFrames } = fakeBrowser('/search', 1480);
  const paths: string[] = [];
  const navigation = createStoreNavigation(browser, path => paths.push(path));
  navigation.navigate('/product/p1');
  browser.scrollTo({ top: 0 });
  navigation.close();
  flushFrames();
  assert.equal(browser.location.pathname, '/search');
  assert.equal(browser.scrollY, 1480);
  assert.equal(entries.length, 2);
  assert.deepEqual(paths, ['/product/p1', '/search']);
});
test('Native Back uses the same restoration when a product was opened from a category', () => {
  const { browser, flushFrames } = fakeBrowser('/', 925);
  let currentPath = '/';
  const navigation = createStoreNavigation(browser, path => { currentPath = path; });
  navigation.navigate('/product/p1');
  browser.scrollTo({ top: 0 });
  browser.history.back();
  flushFrames();
  assert.equal(currentPath, '/');
  assert.equal(browser.scrollY, 925);
});
test('Related products go back one entry at a time before returning to the catalog', () => {
  const { browser, entries, flushFrames } = fakeBrowser('/search', 1620);
  const navigation = createStoreNavigation(browser, () => {});
  navigation.navigate('/product/p1');
  navigation.navigate('/product/p2');
  navigation.close();
  flushFrames();
  assert.equal(browser.location.pathname, '/product/p1');
  navigation.close();
  flushFrames();
  assert.equal(browser.location.pathname, '/search');
  assert.equal(browser.scrollY, 1620);
  assert.equal(entries.length, 3);
});
test('A product opened from the cart returns to the cart', () => {
  const { browser, flushFrames } = fakeBrowser('/cart', 680);
  const navigation = createStoreNavigation(browser, () => {});
  navigation.navigate('/product/p1');
  navigation.close();
  flushFrames();
  assert.equal(browser.location.pathname, '/cart');
});
test('Closing a direct product link replaces it with the catalog', () => {
  const { browser, entries, flushFrames } = fakeBrowser('/product/shared', 75);
  const navigation = createStoreNavigation(browser, () => {});
  navigation.close();
  flushFrames();
  assert.equal(browser.location.pathname, '/');
  assert.equal(browser.scrollY, 0);
  assert.equal(entries.length, 1);
});
test('Repeated navigation to the same product creates no duplicate entry', () => {
  const { browser, entries } = fakeBrowser('/');
  const navigation = createStoreNavigation(browser, () => {});
  navigation.navigate('/product/p1');
  navigation.navigate('/product/p1');
  assert.equal(entries.length, 2);
});
test('A new navigation cancels pending scroll restoration', () => {
  const { browser, flushFrames } = fakeBrowser('/search', 2000);
  const navigation = createStoreNavigation(browser, () => {});
  navigation.navigate('/product/p1');
  navigation.close();
  navigation.navigate('/cart');
  browser.scrollTo({ top: 40 });
  flushFrames();
  assert.equal(browser.scrollY, 40);
});
test('Disposal removes listeners and restores the browser scroll policy', () => {
  const { browser, listeners } = fakeBrowser();
  const navigation = createStoreNavigation(browser, () => {});
  assert.equal(browser.history.scrollRestoration, 'manual');
  navigation.dispose();
  assert.equal(listeners.size, 0);
  assert.equal(browser.history.scrollRestoration, 'auto');
});
