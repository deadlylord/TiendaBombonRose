import test from 'node:test';
import assert from 'node:assert/strict';
import { availableVariantOptions, searchCatalog, type CatalogFilters } from '../services/catalogSearch';
import { buildCatalog, DEFAULT_COMPANY_ID } from '../services/catalog';
import type { Product } from '../types';

const product = (changes: Partial<Product> = {}): Product => ({ id: 'p1', name: 'Pantalón de lino', rawName: 'SKU Azul', category: 'Pantalones', description: 'Cintura elástica', price: 100000, imageUrl: '', available: true, variants: { hasSizes: true, sizes: { S: { available: false }, M: { available: true } }, hasColors: true, colors: { Azul: { available: true }, Rojo: { available: false } } }, ...changes });
const filters: CatalogFilters = { term: '', category: 'All', size: '', color: '', sort: 'recent' };

test('Search matches all words without accents across name, description and category', () => {
  assert.equal(searchCatalog([product()], { ...filters, term: ' PANTALON elastica ' }).length, 1);
  assert.equal(searchCatalog([product()], { ...filters, term: 'pantalones azul' }).length, 1);
  assert.equal(searchCatalog([product()], { ...filters, term: 'pantalon rojo' }).length, 0);
});
test('Size and color filters only include enabled, available variants', () => {
  assert.equal(searchCatalog([product()], { ...filters, size: 'M', color: 'Azul' }).length, 1);
  assert.equal(searchCatalog([product()], { ...filters, size: 'S' }).length, 0);
  assert.equal(searchCatalog([product()], { ...filters, color: 'Rojo' }).length, 0);
  assert.equal(searchCatalog([product({ variants: { ...product().variants, hasSizes: false } })], { ...filters, size: 'M' }).length, 0);
});
test('Price ordering uses the final discounted price and leaves input order intact', () => {
  const input = [product({ id: 'full', price: 80000 }), product({ id: 'discount', price: 100000, discountPercentage: 40 })];
  assert.deepEqual(searchCatalog(input, { ...filters, sort: 'price-asc' }).map(item => item.id), ['discount', 'full']);
  assert.deepEqual(searchCatalog(input, { ...filters, sort: 'price-desc' }).map(item => item.id), ['full', 'discount']);
  assert.deepEqual(input.map(item => item.id), ['full', 'discount']);
});
test('Category and offers filters compose with search and sizes', () => {
  const input = [product({ discountPercentage: 20 }), product({ id: 'other', category: 'Blusas' })];
  assert.equal(searchCatalog(input, { ...filters, category: 'On Sale', size: 'M' }).length, 1);
  assert.equal(searchCatalog(input, { ...filters, category: 'Blusas', term: 'inexistente' }).length, 0);
});
test('Recent ordering uses the latest creation or update date', () => {
  const input = [product({ id: 'new', createdAt: 5 }), product({ id: 'updated', createdAt: 1, updatedAt: 10 })];
  assert.equal(searchCatalog(input, filters)[0].id, 'updated');
});
test('Filter options contain distinct available variants only', () => {
  assert.deepEqual(availableVariantOptions([product(), product()], 'sizes'), ['M']);
  assert.deepEqual(availableVariantOptions([product(), product()], 'colors'), ['Azul']);
});
test('Gallery and size guide survive catalog extensions without crossing companies', () => {
  const inventory = [{ docId: 'p1', sku: '1', name: 'Prenda', companyId: DEFAULT_COMPANY_ID, storeId: '1', stock: 3, price: 100000 }];
  const extension = { docId: 'p1', companyId: DEFAULT_COMPANY_ID, additionalImages: ['detail.jpg'], sizeGuideText: 'M: cintura 70 cm' };
  const result = buildCatalog(inventory, [], [extension], DEFAULT_COMPANY_ID)[0];
  assert.deepEqual(result.additionalImages, ['detail.jpg']);
  assert.equal(result.sizeGuideText, 'M: cintura 70 cm');
  assert.equal(buildCatalog(inventory, [], [{ ...extension, companyId: 'other' }], DEFAULT_COMPANY_ID)[0].sizeGuideText, '');
});
