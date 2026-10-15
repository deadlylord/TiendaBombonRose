import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StoreLoader from '../components/StoreLoader';

test('The initial HTML shows the same loading screen as React before application code downloads', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const initialScreen = html.match(/<div id="root">(.*?)<\/div>\s*<noscript>/s)?.[1];
  assert.equal(initialScreen, renderToStaticMarkup(createElement(StoreLoader)));
  assert.match(html, /<style id="store-loading-styles">/);
  assert.match(html, /@keyframes store-loading-carousel/);
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
  assert.doesNotMatch(html, /store-startup__carousel/);
});
