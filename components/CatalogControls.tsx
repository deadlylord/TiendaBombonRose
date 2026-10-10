import { CatalogFilters, CatalogSort } from '../services/catalogSearch';

interface Props {
  filters: CatalogFilters;
  categories: string[];
  sizes: string[];
  colors: string[];
  count: number;
  onChange: (filters: CatalogFilters) => void;
}

export default function CatalogControls({ filters, categories, sizes, colors, count, onChange }: Props) {
  const selectClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm';
  return <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <label className="text-sm font-medium">Categoría
        <select className={selectClass} value={filters.category} onChange={event => onChange({ ...filters, category: event.target.value })}>
          <option value="All">Todas las categorías</option><option value="On Sale">Ofertas</option>
          {categories.map(category => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Talla
        <select className={selectClass} value={filters.size} onChange={event => onChange({ ...filters, size: event.target.value })}>
          <option value="">Todas las tallas</option>{sizes.map(size => <option key={size}>{size}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Color
        <select className={selectClass} value={filters.color} onChange={event => onChange({ ...filters, color: event.target.value })}>
          <option value="">Todos los colores</option>{colors.map(color => <option key={color}>{color}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Ordenar
        <select className={selectClass} value={filters.sort} onChange={event => onChange({ ...filters, sort: event.target.value as CatalogSort })}>
          <option value="recent">Más recientes</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option>
        </select>
      </label>
    </div>
    <div className="mt-4 flex items-center justify-between gap-4 text-sm">
      <p role="status" aria-live="polite">{count} {count === 1 ? 'producto' : 'productos'}</p>
      <button type="button" className="font-semibold text-primary hover:underline" onClick={() => onChange({ term: '', category: 'All', size: '', color: '', sort: 'recent' })}>Limpiar filtros</button>
    </div>
  </div>;
}
