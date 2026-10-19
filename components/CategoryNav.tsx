import { useMemo } from 'react';
import { Category, Product } from '../types';
import { orderCategories } from '../services/categoryOrder';
import ProductImage from './ProductImage';
import { ShoppingBagIcon } from './Icons';

export default function CategoryNav({ categories, products, selectedCategory, onSelectCategory, onOpenCollections, collectionsImage, images = {} }: {
  images?: Record<string, string>;
  collectionsImage?: string;
  onOpenCollections?: () => void;
  categories: Category[];
  products: Product[];
  selectedCategory: string;
  onSelectCategory: (category: Category | 'All') => void;
}) {
  const hasCollections = !!onOpenCollections;
  const entries = useMemo(() => {
    const photos = new Map<string, string>();
    const availablePhotos = products.filter(product => product.available && product.imageUrl);
    for (const product of [...availablePhotos, ...products]) {
      if (product.imageUrl && !photos.has(product.category)) photos.set(product.category, product.imageUrl);
    }
    return [
      { name: 'All', label: 'Todo', image: images.All || availablePhotos[0]?.imageUrl || products.find(product => product.imageUrl)?.imageUrl },
      ...(hasCollections ? [{ name: '__collections', label: 'Colecciones', image: collectionsImage }] : []),
      ...orderCategories(categories).map(name => ({ name, label: name, image: images[name] || photos.get(name) })),
    ];
  }, [categories, products, images, hasCollections, collectionsImage]);

  return <nav aria-label="Explora por categoría" className="border-b border-pink-100 bg-white py-6 sm:py-9">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-xl text-[#880E4F] sm:text-2xl">Encuentra tu estilo</h2>
        <span className="text-xs text-gray-500 sm:text-sm">Desliza para explorar</span>
      </div>
      <div className="category-photo-track flex gap-4 overflow-x-auto pb-3 sm:gap-7">
        {entries.map(({ name, label, image }) => {
          const active = selectedCategory === name;
          return <button key={name} type="button" aria-pressed={active} onClick={() => name === '__collections' ? onOpenCollections?.() : onSelectCategory(name)}
            className="group w-28 shrink-0 snap-start text-center sm:w-40">
            <span className={`block aspect-square w-full rounded-full border-2 p-1 transition-colors ${active ? 'border-[#E91E8C] bg-pink-50' : 'border-pink-100 group-hover:border-pink-300'}`}>
              <span className="block h-full w-full overflow-hidden rounded-full bg-pink-50">
                {name === '__collections' && !image ? <span className="flex h-full w-full items-center justify-center text-[#E91E8C]" aria-hidden="true"><ShoppingBagIcon className="h-12 w-12 sm:h-16 sm:w-16" /></span> : <ProductImage src={image} alt={name === '__collections' ? 'Colecciones' : `Categoría ${label}`} className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />}
              </span>
            </span>
            <span className={`mt-3 block break-words text-xs leading-snug sm:text-sm ${active ? 'font-bold text-[#880E4F]' : 'font-medium text-gray-700'}`}>{label}</span>
            <span aria-hidden="true" className={`mx-auto mt-2 block h-1 w-5 rounded-full ${active ? 'bg-[#E91E8C]' : 'bg-transparent'}`} />
          </button>;
        })}
      </div>
    </div>
  </nav>;
}
