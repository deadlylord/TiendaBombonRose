import test from 'node:test';
import assert from 'node:assert/strict';
import type { Product, StoreCollection, StoreConfig } from '../types';
import { collectionIdFromPath, collectionPath, collectionProducts, publishedCollections } from '../services/storeCollections';
import { bannerDestination } from '../services/bannerDestinations';

const halloween: StoreCollection = { id: 'halloween', name: 'Halloween', description: '', imageUrl: '', published: true, productIds: ['p2', 'p1', 'p2', 'missing'] };
const product = (id: string, companyId = 'bombon', available = true) => ({ id, companyId, available }) as Product;

test('Only published collections from the active company are shown, including on direct links', () => {
  const config = { collectionsByCompany: { bombon: [halloween, { ...halloween, id: 'draft', published: false }], mayla: [{ ...halloween, id: 'private' }] } } as unknown as StoreConfig;
  assert.deepEqual(publishedCollections(config, 'bombon').map(collection => collection.id), ['halloween']);
  assert.deepEqual(publishedCollections(config, 'unknown'), []);
});

test('A collection uses selected IDs once, preserves selection order and excludes unavailable or foreign products', () => {
  const members = collectionProducts(halloween, [product('p1'), product('p2'), product('missing', 'mayla')], 'bombon');
  assert.deepEqual(members.map(member => member.id), ['p2', 'p1']);
  assert.deepEqual(collectionProducts(halloween, [product('p1', 'bombon', false), product('p2', 'mayla')], 'bombon'), []);
  assert.deepEqual(halloween.productIds, ['p2', 'p1', 'p2', 'missing']);
});

test('Products remain available individually and can belong to more than one collection', () => {
  const products = [product('p1')];
  assert.equal(collectionProducts(halloween, products, 'bombon')[0], products[0]);
  assert.equal(collectionProducts({ ...halloween, id: 'new' }, products, 'bombon')[0], products[0]);
  assert.equal(products.length, 1);
  assert.equal(collectionProducts(halloween, [], 'bombon').length, 0);
  assert.equal(collectionProducts(halloween, products, 'bombon').length, 1);
});

test('Collection links are shareable routes and resolve as banner destinations with encoded IDs', () => {
  const id = 'Halloween #ñ 2026';
  const path = collectionPath(id);
  assert.equal(collectionIdFromPath(path), id);
  assert.deepEqual(bannerDestination(path), { kind: 'collection', collectionId: id, href: path });
  assert.equal(collectionIdFromPath('/collection/%ZZ'), null);
  assert.equal(bannerDestination('/collection/').kind, 'none');
});
