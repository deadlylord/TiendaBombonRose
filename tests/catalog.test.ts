import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog, catalogCompany, DEFAULT_COMPANY_ID, inventoryBelongsToCompany, validateCart, type CatalogRow } from '../services/catalog';
import type { CartItem } from '../types';

const row = (overrides: Partial<CatalogRow> = {}): CatalogRow => ({ docId: 'p1', sku: 'SKU-1', name: 'Pantalón White', companyId: DEFAULT_COMPANY_ID, storeId: '1', categoryId: 'cat1', stock: 2, price: 100000, imageUrl: 'white.jpg', ...overrides });
const categories = [{ docId: 'cat1', name: 'Pantalones' }];
const build = (rows = [row()], extensions: CatalogRow[] = [], company = DEFAULT_COMPANY_ID) => buildCatalog(rows, categories, extensions, company);
const cartItem = (overrides: Partial<CartItem> = {}): CartItem => ({ id: 'p1', productId: 'p1', name: 'Pantalón White', quantity: 1, price: 100000, imageUrl: 'white.jpg', ...overrides });

test('Existing settings default to the original Bombón/Street company', () => {
  assert.equal(catalogCompany({}), DEFAULT_COMPANY_ID);
  assert.equal(catalogCompany({ inventoryCompanyId: ' mayla ' }), 'mayla');
});
test('Original storefront excludes another company even with the same SKU/name', () => {
  assert.equal(build([row(), row({ docId: 'other', companyId: 'mayla', stock: 100 })])[0].stock, 2);
});
test('Historical inventory is allowed only for the three original stores', () => {
  assert.equal(inventoryBelongsToCompany(row({ companyId: undefined }), DEFAULT_COMPANY_ID), true);
  assert.equal(inventoryBelongsToCompany(row({ companyId: undefined, storeId: 'mayla-store' }), DEFAULT_COMPANY_ID), false);
  assert.equal(inventoryBelongsToCompany(row({ companyId: undefined }), 'mayla'), false);
  assert.equal(inventoryBelongsToCompany(row({ companyId: 'mayla' }), DEFAULT_COMPANY_ID), false);
});
test('Custom company does not inherit original or untagged products', () => {
  const products = build([row(), row({ docId: 'mayla-product', companyId: 'mayla' }), row({ docId: 'legacy', companyId: undefined })], [], 'mayla');
  assert.deepEqual(products.map(product => product.id), ['mayla-product']);
});
test('Matching variants across stores sum stock and keep a stable customized ID', () => {
  const products = build([row({ docId: 'z', createdAt: 5 }), row({ docId: 'a', storeId: '2', stock: 3, createdAt: 50 })], [{ docId: 'z', nameOverride: 'White' }]);
  assert.equal(products.length, 1);
  assert.equal(products[0].stock, 5);
  assert.equal(products[0].id, 'z');
  assert.equal(products[0].createdAt, 50);
});
test('A sold-out store does not erase web customizations while another store still has stock', () => {
  const products = build([row({ docId: 'z', stock: 0 }), row({ docId: 'a', storeId: '2', stock: 3 })], [{ docId: 'z', nameOverride: 'White' }]);
  assert.equal(products[0].id, 'z');
  assert.equal(products[0].name, 'White');
  assert.equal(products[0].stock, 3);
});
test('Identical names with different SKUs, prices or categories stay separate', () => {
  assert.equal(build([row(), row({ docId: 'p2', sku: 'SKU-2' })]).length, 2);
  assert.equal(build([row(), row({ docId: 'p2', price: 120000 })]).length, 2);
  assert.equal(build([row(), row({ docId: 'p2', categoryId: 'cat2' })]).length, 2);
});
test('Missing SKUs do not cause unrelated products with matching names to merge', () => {
  assert.equal(build([row({ sku: '' }), row({ sku: '', docId: 'p2' })]).length, 2);
});
test('Disabled, zero-stock and invalid-stock products are excluded before consolidation', () => {
  assert.equal(build([row(), row({ docId: 'p2', isDisabled: true, stock: 100 }), row({ docId: 'p3', stock: -5 }), row({ docId: 'p4', stock: NaN })])[0].stock, 2);
});
test('A customization from another company cannot change the displayed price', () => {
  assert.equal(build([row()], [{ docId: 'p1', companyId: 'mayla', priceOverride: 1 }])[0].price, 100000);
});
test('Historical customizations are not inherited by a different company', () => {
  assert.equal(build([row({ companyId: 'mayla' })], [{ docId: 'p1', priceOverride: 1 }], 'mayla')[0].price, 100000);
});
test('Product names retain their last word, and origin is not guessed', () => {
  const product = build()[0];
  assert.equal(product.name, 'Pantalón White');
  assert.equal(product.madeInColombia, false);
});
test('Foreign categories do not supply names to the selected company', () => {
  assert.equal(buildCatalog([row()], [{ docId: 'cat1', companyId: 'mayla', name: 'Private' }], [], DEFAULT_COMPANY_ID)[0].category, 'General');
});
test('All cart variants count toward the same product stock limit', () => {
  assert.throws(() => validateCart([cartItem({ id: 'p1-S', size: 'S', quantity: 2 }), cartItem({ id: 'p1-M', size: 'M' })], build()), /Solo hay 2/);
});
test('Checkout rejects products removed after being added to the cart', () => {
  assert.throws(() => validateCart([cartItem()], []), /ya no está disponible/);
});
test('Checkout refreshes prices from the current catalog', () => {
  assert.equal(validateCart([cartItem({ price: 1 })], build())[0].price, 100000);
});
test('Checkout rejects unavailable sizes/colors and invalid quantities', () => {
  const products = build([row()], [{ docId: 'p1', variants: { hasSizes: true, sizes: { S: { available: true } }, hasColors: true, colors: { Rosa: { available: true } } } }]);
  assert.throws(() => validateCart([cartItem({ size: 'M', color: 'Rosa' })], products), /talla/);
  assert.throws(() => validateCart([cartItem({ size: 'S', color: 'Azul' })], products), /color/);
  assert.throws(() => validateCart([cartItem({ quantity: -1 })], build()), /cantidades/);
  assert.throws(() => validateCart([], build()), /vacío/);
});
