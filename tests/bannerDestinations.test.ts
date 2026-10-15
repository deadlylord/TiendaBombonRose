import test from 'node:test';
import assert from 'node:assert/strict';
import { bannerDestination } from '../services/bannerDestinations';

test('Banner categories preserve accents, spaces and colons from existing configuration', () => {
  assert.deepEqual(bannerDestination('category:Blusas: Bodys Mujer'), { kind: 'category', category: 'Blusas: Bodys Mujer', href: '#productos' });
  assert.equal(bannerDestination('category:').kind, 'none');
  assert.equal(bannerDestination('#productos').kind, 'catalog');
});

test('Product destinations use stable product IDs and survive URL encoding', () => {
  const id = 'Prenda ñ #20%';
  const expected = { kind: 'product', productId: id, href: `/product/${encodeURIComponent(id)}` };
  assert.deepEqual(bannerDestination(`/product/${encodeURIComponent(id)}`), expected);
  assert.deepEqual(bannerDestination(`product:${id}`), expected);
  assert.equal(bannerDestination('/product/').kind, 'none');
  assert.equal(bannerDestination('/product/%ZZ').kind, 'none');
});

test('Manual destinations accept web links and reject incomplete or executable schemes', () => {
  assert.equal(bannerDestination('https://example.com/coleccion?prenda=1').kind, 'external');
  for (const link of ['', '#', 'javascript:alert(1)', 'data:text/html,test', 'https://']) assert.equal(bannerDestination(link).kind, 'none');
});
