import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StoreLoader from '../components/StoreLoader';
import { createStartupReveal } from '../services/startupScreen';

test('The initial HTML shows the same loading screen as React before application code downloads', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const initialScreen = html.match(/<div id="store-startup-screen">(.*?)<\/div>\s*<div id="root"><\/div>/s)?.[1];
  assert.equal(initialScreen, renderToStaticMarkup(createElement(StoreLoader)));
  assert.match(html, /<style id="store-loading-styles">/);
  assert.match(html, /@keyframes store-loading-spin/);
  assert.match(initialScreen!, /Descubre tu próximo outfit/);
  assert.doesNotMatch(initialScreen!, /store-startup__(brand|letter|dots)/);
  // Fonts must not hold up the first paint on slower connections.
  const blockingStylesheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].filter(([link]) => !link.includes('media="print"'));
  assert.equal(blockingStylesheets.length, 0);
});

test('A failed application download replaces the loading animation with an accessible retry', () => {
  const html = renderToStaticMarkup(createElement(StoreLoader, { failed: true }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Revisa tu conexión/);
  assert.match(html, /<button[^>]*>Volver a intentar<\/button>/);
  assert.doesNotMatch(html, /store-startup__spinner/);
});

test('The original loading node stays until layout is ready and is dismissed only once', () => {
  const frames: FrameRequestCallback[] = [];
  let removed = 0;
  const reveal = createStartupReveal({
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    document: { getElementById(id) { assert.equal(id, 'store-startup-screen'); return { remove() { removed++; } }; } },
  });
  reveal(); reveal();
  assert.equal(frames.length, 1);
  assert.equal(removed, 0);
  frames.shift()!(0);
  assert.equal(removed, 0);
  frames.shift()!(1);
  assert.equal(removed, 1);
  reveal();
  assert.equal(frames.length, 0);
});

test('A route or retry can reveal the shop even if the initial loader was already removed', () => {
  const frames: FrameRequestCallback[] = [];
  const reveal = createStartupReveal({
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    document: { getElementById() { return null; } },
  });
  reveal();
  frames.shift()!(0);
  assert.doesNotThrow(() => frames.shift()!(1));
});
