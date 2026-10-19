export type BannerDestination =
  | { kind: 'catalog'; href: string }
  | { kind: 'category'; category: string; href: string }
  | { kind: 'collection'; collectionId: string; href: string }
  | { kind: 'product'; productId: string; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'none'; href: string };

export function bannerDestination(link: string): BannerDestination {
  const value = link?.trim() || '';
  if (value === '#productos' || value === '/search') return { kind: 'catalog', href: '/search' };
  if (value.startsWith('category:') && value.slice(9).trim()) return { kind: 'category', category: value.slice(9), href: '#productos' };
  const collection = value.match(/^\/collection\/([^/?#]+)$/)?.[1];
  if (collection) {
    try { const id = decodeURIComponent(collection); return { kind: 'collection', collectionId: id, href: `/collection/${encodeURIComponent(id)}` }; }
    catch { return { kind: 'none', href: '' }; }
  }
  const product = value.startsWith('product:') ? value.slice(8) : value.match(/^\/product\/([^/?#]+)$/)?.[1];
  if (product) {
    let id = product;
    if (!value.startsWith('product:')) { try { id = decodeURIComponent(product); } catch { return { kind: 'none', href: '' }; } }
    return { kind: 'product', productId: id, href: `/product/${encodeURIComponent(id)}` };
  }
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return { kind: 'external', href: url.href };
  } catch { /* Empty or incomplete destinations have no active link. */ }
  return { kind: 'none', href: '' };
}
