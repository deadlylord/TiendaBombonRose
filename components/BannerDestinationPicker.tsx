import { useState } from 'react';
import type { Product, StoreCollection } from '../types';
import { bannerDestination } from '../services/bannerDestinations';
import { normalizeSearch } from '../services/catalogSearch';
import ProductImage from './ProductImage';

export default function BannerDestinationPicker({ link, categories, products, collections, onChange }: {
  link: string; categories: string[]; products: Product[]; collections: StoreCollection[]; onChange: (link: string) => void;
}) {
  const destination = bannerDestination(link);
  const [chosenType, setChosenType] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const type = chosenType || (destination.kind === 'none' ? (link.startsWith('category:') ? 'category' : link.startsWith('/product/') ? 'product' : link.startsWith('/collection/') ? 'collection' : 'external') : destination.kind);
  const selectedProduct = destination.kind === 'product' ? products.find(product => product.id === destination.productId) : undefined;
  const matches = products.filter(product => normalizeSearch(`${product.name} ${product.category}`).includes(normalizeSearch(search))).slice(0, 80);
  if (selectedProduct && !matches.some(product => product.id === selectedProduct.id)) matches.unshift(selectedProduct);
  const selectClasses = 'mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-800';
  return <div className="space-y-3 rounded-xl border border-pink-100 bg-pink-50/50 p-4 text-gray-800">
    <label className="block text-sm font-medium">Al tocar este banner, abrir
      <select value={type} className={selectClasses} onChange={event => {
        const type = event.target.value; setChosenType(type); setSearch('');
        onChange(type === 'catalog' ? '#productos' : type === 'category' ? 'category:' : type === 'product' ? '/product/' : type === 'collection' ? '/collection/' : '');
      }}>
        <option value="catalog">Todo el catálogo</option><option value="category">Una categoría</option><option value="product">Una prenda</option><option value="collection">Una colección</option><option value="external">Un enlace web</option>
      </select>
    </label>
    {type === 'category' && <label className="block text-sm">Categoría
      <select value={destination.kind === 'category' ? destination.category : ''} onChange={event => onChange(`category:${event.target.value}`)} className={selectClasses}>
        <option value="">Selecciona una categoría</option>
        {destination.kind === 'category' && !categories.includes(destination.category) && <option value={destination.category}>{destination.category} (no disponible)</option>}
        {categories.map(category => <option key={category} value={category}>{category}</option>)}
      </select>
    </label>}
    {type === 'collection' && <label className="block text-sm">Colección
      <select value={destination.kind === 'collection' ? destination.collectionId : ''} onChange={event => onChange(event.target.value ? `/collection/${encodeURIComponent(event.target.value)}` : '/collection/')} className={selectClasses}>
        <option value="">Selecciona una colección</option>
        {destination.kind === 'collection' && !collections.some(collection => collection.id === destination.collectionId) && <option value={destination.collectionId}>Colección no disponible: elige otra</option>}
        {collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}{collection.published ? '' : ' (borrador: publícala para que se vea)'}</option>)}
      </select>
      {collections.length === 0 && <span className="mt-2 block text-xs text-gray-500">Primero crea y guarda la colección en Admin → Colecciones.</span>}
    </label>}
    {type === 'product' && <>
      <label className="block text-sm">Buscar prenda<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Escribe el nombre…" className={selectClasses} /></label>
      <label className="block text-sm">Prenda
        <select value={destination.kind === 'product' ? destination.productId : ''} onChange={event => onChange(event.target.value ? `/product/${encodeURIComponent(event.target.value)}` : '/product/')} className={selectClasses}>
          <option value="">Selecciona una prenda</option>
          {destination.kind === 'product' && !selectedProduct && <option value={destination.productId}>Prenda no disponible: elige otra</option>}
          {matches.map(product => <option key={product.id} value={product.id}>{product.name} · {product.category}</option>)}
        </select>
      </label>
      {selectedProduct && <div className="flex items-center gap-3"><ProductImage src={selectedProduct.imageUrl} alt={selectedProduct.name} className="h-16 w-12 rounded-lg object-cover" /><span className="text-sm">{selectedProduct.name}</span></div>}
      <p className="text-xs text-gray-500">Busca por nombre si no aparece en las primeras opciones.</p>
    </>}
    {type === 'external' && <label className="block text-sm">Dirección web<input type="url" value={link} onChange={event => onChange(event.target.value)} placeholder="https://…" className={selectClasses} /></label>}
    {destination.kind === 'none' && <p className="text-xs text-rose-700">Completa el destino antes de guardar.</p>}
    {destination.kind !== 'none' && <p className="text-xs text-gray-500">El botón del banner llevará a este destino. Guarda los banners para aplicar el cambio.</p>}
  </div>;
}
