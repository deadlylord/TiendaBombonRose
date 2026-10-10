import { Product } from '../types';

export type CatalogSort = 'recent' | 'price-asc' | 'price-desc';
export interface CatalogFilters {
  term: string;
  category: string;
  size: string;
  color: string;
  sort: CatalogSort;
}

export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
export const salePrice = (product: Product) => product.price * (1 - Math.min(100, Math.max(0, product.discountPercentage || 0)) / 100);

export function searchCatalog(products: Product[], filters: CatalogFilters): Product[] {
  const words = normalizeSearch(filters.term).split(/\s+/).filter(Boolean);
  return products.filter(product => {
    if (filters.category === 'On Sale' && !(product.discountPercentage && product.discountPercentage > 0)) return false;
    if (filters.category !== 'All' && filters.category !== 'On Sale' && product.category !== filters.category) return false;
    if (filters.size && (!product.variants?.hasSizes || !product.variants.sizes?.[filters.size]?.available)) return false;
    if (filters.color && (!product.variants?.hasColors || !product.variants.colors?.[filters.color]?.available)) return false;
    const text = normalizeSearch(`${product.name} ${product.rawName || ''} ${product.category} ${product.description || ''}`);
    return words.every(word => text.includes(word));
  }).sort((a, b) => {
    if (filters.sort === 'price-asc') return salePrice(a) - salePrice(b);
    if (filters.sort === 'price-desc') return salePrice(b) - salePrice(a);
    return Math.max(b.updatedAt || 0, b.createdAt || 0) - Math.max(a.updatedAt || 0, a.createdAt || 0);
  });
}

export function availableVariantOptions(products: Product[], kind: 'sizes' | 'colors'): string[] {
  const flag = kind === 'sizes' ? 'hasSizes' : 'hasColors';
  return [...new Set(products.flatMap(product => product.variants?.[flag]
    ? Object.entries(product.variants[kind] || {}).filter(([, detail]) => detail.available).map(([name]) => name)
    : []))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}
