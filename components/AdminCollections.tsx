import { useEffect, useState } from 'react';
import type { Product, StoreCollection } from '../types';
import { normalizeSearch } from '../services/catalogSearch';
import { collectionPath } from '../services/storeCollections';
import { uploadImageToStorage } from '../services/imageUploads';
import ProductImage from './ProductImage';

export default function AdminCollections({ collections, products, onSave }: {
  collections: StoreCollection[]; products: Product[]; onSave: (collections: StoreCollection[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState(collections);
  const [selectedId, setSelectedId] = useState(collections[0]?.id || '');
  const [search, setSearch] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setDraft(collections); }, [collections]);
  const selected = draft.find(collection => collection.id === selectedId);
  const update = (value: Partial<StoreCollection>) => {
    setDraft(previous => previous.map(collection => collection.id === selectedId ? { ...collection, ...value } : collection)); setMessage('');
  };
  const add = () => {
    const collection: StoreCollection = { id: crypto.randomUUID(), name: '', description: '', imageUrl: '', productIds: [], published: false };
    setDraft(previous => [...previous, collection]); setSelectedId(collection.id); setSearch(''); setOnlySelected(false); setMessage('');
  };
  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      if (draft.some(collection => !collection.name.trim())) throw new Error('Escribe el nombre de cada colección.');
      if (draft.some(collection => collection.published && !collection.productIds.length)) throw new Error('Añade al menos una prenda a las colecciones publicadas.');
      await onSave(draft.map(collection => ({ ...collection, name: collection.name.trim(), productIds: [...new Set(collection.productIds)] })));
      setMessage('Colecciones guardadas. Las publicadas ya están disponibles en la tienda.');
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudieron guardar las colecciones.'); }
    finally { setSaving(false); }
  };
  const visible = products.filter(product => (!onlySelected || selected?.productIds.includes(product.id)) && normalizeSearch(`${product.name} ${product.category}`).includes(normalizeSearch(search)));
  const missingIds = selected?.productIds.filter(id => !products.some(product => product.id === id)) || [];
  return <section className="space-y-5 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Colecciones</h1><p className="mt-1 text-sm text-gray-600">Reúne prendas para Halloween, promociones o una selección especial. Siguen apareciendo en su categoría habitual.</p></div></div>
    <fieldset disabled={saving || uploading} className="space-y-5">
      <div className="flex flex-wrap gap-3"><button type="button" onClick={add} className="rounded-xl bg-pink-50 px-5 py-3 font-semibold text-pink-800">Crear colección</button><button type="button" onClick={() => void save()} className="rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar colecciones'}</button></div>
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Colecciones para editar" className="space-y-2">{draft.map(collection => <button key={collection.id} type="button" onClick={() => { setSelectedId(collection.id); setSearch(''); }} className={`block w-full rounded-xl border p-3 text-left ${selectedId === collection.id ? 'border-pink-300 bg-pink-50' : 'border-gray-200 bg-white'}`}><span className="block font-medium">{collection.name || 'Nueva colección'}</span><span className="text-xs text-gray-500">{collection.productIds.length} prendas · {collection.published ? 'Publicada' : 'Borrador'}</span></button>)}</nav>
        {selected ? <div className="min-w-0 space-y-5 rounded-2xl border border-pink-100 bg-white p-4 sm:p-6">
          <label className="block text-sm font-medium">Nombre<input value={selected.name} maxLength={100} onChange={event => update({ name: event.target.value })} placeholder="Ej. Halloween" className="mt-1 w-full rounded-lg border p-3" /></label>
          <label className="block text-sm font-medium">Descripción<textarea value={selected.description} maxLength={1500} onChange={event => update({ description: event.target.value })} placeholder="Presenta tu selección de prendas…" className="mt-1 w-full rounded-lg border p-3" rows={3} /></label>
          <div className="flex flex-wrap items-center gap-4">{selected.imageUrl && <ProductImage src={selected.imageUrl} alt="Portada de la colección" className="h-24 w-24 rounded-xl object-cover" />}<label className="block text-sm font-medium">Portada (opcional)<input type="file" accept="image/*" className="mt-2 block w-full text-xs" onChange={async event => {
            const file = event.target.files?.[0]; if (!file) return;
            const id = selected.id; setUploading(true); setError('');
            try { const imageUrl = await uploadImageToStorage(file, true); setDraft(previous => previous.map(collection => collection.id === id ? { ...collection, imageUrl } : collection)); }
            catch { setError('No se pudo subir la portada. Intenta otra vez.'); }
            finally { setUploading(false); }
          }} /></label>{selected.imageUrl && <button type="button" onClick={() => update({ imageUrl: '' })} className="text-xs text-pink-700 underline">Quitar portada</button>}</div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={selected.published} onChange={event => update({ published: event.target.checked })} />Publicar en la tienda</label>
          <p className="text-xs text-gray-500">Enlace al guardar y publicar: <span className="break-all">{window.location.origin}{collectionPath(selected.id)}</span></p>
          <div className="border-t pt-4"><h2 className="font-semibold">Prendas de la colección · {selected.productIds.length}</h2><label className="mt-3 block text-sm">Buscar prendas<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre o categoría" className="mt-1 w-full rounded-lg border p-3" /></label><label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={onlySelected} onChange={event => setOnlySelected(event.target.checked)} />Mostrar solo seleccionadas</label>
            <div className="grid max-h-[460px] gap-2 overflow-y-auto sm:grid-cols-2">{visible.map(product => <label key={product.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2 ${selected.productIds.includes(product.id) ? 'border-pink-300 bg-pink-50' : 'border-gray-100'}`}><input type="checkbox" checked={selected.productIds.includes(product.id)} onChange={event => update({ productIds: event.target.checked ? [...selected.productIds, product.id] : selected.productIds.filter(id => id !== product.id) })} /><ProductImage src={product.imageUrl} alt={product.name} className="h-16 w-12 shrink-0 rounded-lg object-cover" /><span className="min-w-0 text-sm"><span className="block break-words font-medium">{product.name}</span><span className="text-xs text-gray-500">{product.category}</span></span></label>)}</div>
            {visible.length === 0 && <p className="py-5 text-sm text-gray-500">No hay prendas con esos filtros.</p>}
            {missingIds.length > 0 && <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">{missingIds.length} prendas seleccionadas están agotadas o ya no disponibles. Se conservan para que vuelvan a aparecer si regresan al catálogo.<button type="button" onClick={() => update({ productIds: selected.productIds.filter(id => !missingIds.includes(id)) })} className="mt-2 block text-pink-700 underline">Quitar esas prendas de la colección</button></div>}
          </div>
        </div> : <p className="p-6 text-sm text-gray-500">Crea una colección y selecciona las prendas que quieras reunir.</p>}
      </div>
    </fieldset>
    {uploading && <p role="status" className="text-sm text-pink-700">Subiendo portada…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-green-700">{message}</p>}
  </section>;
}
