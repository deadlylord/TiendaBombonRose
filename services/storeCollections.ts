import type { Product, StoreCollection, StoreConfig } from '../types';

export const EMPTY_COLLECTIONS: StoreCollection[] = [];

export function companyCollections(config: StoreConfig, companyId: string): StoreCollection[] {
  return config.collectionsByCompany?.[companyId] || EMPTY_COLLECTIONS;
}

export function publishedCollections(config: StoreConfig, companyId: string): StoreCollection[] {
  return companyCollections(config, companyId).filter(collection => collection.published);
}

export function collectionProducts(collection: StoreCollection, products: Product[], companyId: string): Product[] {
  const byId = new Map(products.filter(product => product.companyId === companyId && product.available).map(product => [product.id, product]));
  return [...new Set(collection.productIds)].flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
}

export function collectionPath(id: string) { return `/collection/${encodeURIComponent(id)}`; }

export function collectionIdFromPath(path: string): string | null {
  const match = path.match(/^\/collection\/([^/]+)$/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
