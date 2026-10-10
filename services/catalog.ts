import type { Product, StoreConfig, CartItem } from '../types';

export const DEFAULT_COMPANY_ID = 'default_company';
// Original Vestika stores (INITIAL_STORES). Legacy inventory has no companyId.
export const ORIGINAL_STORE_IDS = ['1', '2', '3'];
export type CatalogRow = Record<string, any> & { docId: string };

export function catalogCompany(config: Pick<StoreConfig, 'inventoryCompanyId'>) {
  return config.inventoryCompanyId?.trim() || DEFAULT_COMPANY_ID;
}

export function inventoryBelongsToCompany(row: CatalogRow, companyId: string) {
  if (row.companyId) return row.companyId === companyId;
  return companyId === DEFAULT_COMPANY_ID && ORIGINAL_STORE_IDS.includes(row.storeId);
}

export function categoryBelongsToCompany(row: CatalogRow, companyId: string) {
  return (row.companyId || DEFAULT_COMPANY_ID) === companyId;
}

function createdAt(row: CatalogRow): number {
  const value = row.createdAt;
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return new Date(value).getTime() || 0;
}

export function buildCatalog(inventory: CatalogRow[], categories: CatalogRow[], extensions: CatalogRow[], companyId: string): Product[] {
  const categoryMap = new Map(categories.filter(row => categoryBelongsToCompany(row, companyId)).map(row => [row.docId, row]));
  const extensionMap = new Map(extensions.filter(row => (row.companyId || DEFAULT_COMPANY_ID) === companyId).map(row => [row.docId, row]));
  const groups = new Map<string, CatalogRow[]>();
  for (const row of inventory) {
    if (!inventoryBelongsToCompany(row, companyId) || row.isDisabled || !Number.isFinite(row.stock) || row.stock < 0) continue;
    // Never merge distinct SKUs, categories, suppliers or prices just because names match.
    const key = JSON.stringify([row.sku || row.docId, row.name, row.categoryId, row.supplier || row.provider || '', row.price]);
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups.values()].map(rows => {
    // Prefer an existing web customization; otherwise use a stable document ID.
    rows.sort((a, b) => Number(extensionMap.has(b.docId)) - Number(extensionMap.has(a.docId)) || a.docId.localeCompare(b.docId));
    const row = rows[0];
    const extension = extensionMap.get(row.docId);
    const stock = rows.reduce((sum, item) => sum + item.stock, 0);
    return {
      id: row.docId,
      companyId,
      name: extension?.nameOverride ?? row.name ?? 'Producto sin nombre',
      description: extension?.descriptionOverride ?? row.description ?? '',
      price: extension?.priceOverride ?? row.price ?? 0,
      category: categoryMap.get(row.categoryId)?.name || 'General',
      imageUrl: extension?.imageUrlOverride ?? row.imageUrl ?? '',
      additionalImages: extension?.additionalImages || row.additionalImages || [],
      available: stock > 0,
      stock,
      provider: row.supplier || row.provider || '',
      rawName: row.name,
      discountPercentage: extension?.discountPercentage ?? 0,
      variants: extension?.variants || { hasSizes: false, sizes: {}, hasColors: false, colors: {} },
      madeInColombia: extension?.madeInColombia ?? false,
      isFeatured: extension?.isFeatured ?? false,
      isNewArrival: extension?.isNewArrival ?? false,
      createdAt: Math.max(...rows.map(createdAt)),
      updatedAt: extension?.updatedAt || 0,
    } as Product;
  }).filter(product => product.available).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function validateCart(cart: CartItem[], products: Product[]): CartItem[] {
  if (!cart.length) throw new Error('Tu carrito está vacío.');
  const quantities = new Map<string, number>();
  return cart.map(item => {
    const product = products.find(p => p.id === item.productId);
    if (!product || !product.available) throw new Error(`${item.name} ya no está disponible.`);
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error('Revisa las cantidades del carrito.');
    const quantity = (quantities.get(product.id) || 0) + item.quantity;
    quantities.set(product.id, quantity);
    if (product.stock !== undefined && quantity > product.stock) throw new Error(`Solo hay ${product.stock} unidades de ${product.name}.`);
    if (product.variants.hasSizes && (!item.size || !product.variants.sizes[item.size]?.available)) throw new Error(`Revisa la talla de ${product.name}.`);
    if (product.variants.hasColors && (!item.color || !product.variants.colors[item.color]?.available)) throw new Error(`Revisa el color de ${product.name}.`);
    const price = product.price * (1 - (product.discountPercentage || 0) / 100);
    if (!Number.isFinite(price) || price < 0) throw new Error(`El precio de ${product.name} no está disponible.`);
    return { ...item, name: product.name, price, imageUrl: (item.color && product.variants.colors[item.color]?.imageUrl) || product.imageUrl };
  });
}
