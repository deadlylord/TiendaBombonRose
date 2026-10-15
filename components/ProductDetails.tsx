import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product, StoreConfig } from '../types';
import { ArrowLeftIcon, MinusIcon, PlusIcon, ShareIcon } from './Icons';
import ProductImage from './ProductImage';
import { getValidColor } from '../services/productTools';
import { salePrice } from '../services/catalogSearch';

export default function ProductDetails({ product, onClose, onAddToCart, formatCurrency, showToast, allProducts, config, onSelectProduct }: {
  product: Product; onClose: () => void;
  onAddToCart: (product: Product, quantity: number, size?: string, color?: string) => void;
  formatCurrency: (amount: number) => string;
  showToast: (message: string, type?: 'success' | 'error') => void;
  allProducts: Product[]; config: StoreConfig; onSelectProduct: (product: Product) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>();
  const [selectedColor, setSelectedColor] = useState<string>();
  const [galleryImage, setGalleryImage] = useState<string>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const sizes = product.variants?.sizes || {};
  const colors = product.variants?.colors || {};
  const availableSizes = Object.keys(sizes).filter(size => sizes[size].available);
  const availableColors = Object.keys(colors).filter(color => colors[color].available);
  const availability = JSON.stringify([product.id, availableSizes, availableColors, product.stock]);
  const activeProduct = useRef('');
  useEffect(() => {
    if (activeProduct.current !== product.id) {
      activeProduct.current = product.id;
      setQuantity(1); setGalleryImage(undefined);
      setSelectedSize(availableSizes[0]); setSelectedColor(availableColors[0]);
      scrollRef.current?.scrollTo({ top: 0 });
      backRef.current?.focus({ preventScroll: true });
    } else {
      setQuantity(value => Math.max(1, Math.min(value, product.stock ?? value)));
      setSelectedSize(value => value && availableSizes.includes(value) ? value : availableSizes[0]);
      setSelectedColor(value => value && availableColors.includes(value) ? value : availableColors[0]);
    }
  }, [availability]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const gallery = [...new Set([product.imageUrl, ...(product.additionalImages || []), ...Object.values(colors).map(color => color.imageUrl || '')].filter(Boolean))];
  const displayImage = galleryImage || (selectedColor && colors[selectedColor]?.imageUrl) || product.imageUrl;
  const price = salePrice(product);
  const disabled = !product.available || (product.variants.hasSizes && (!selectedSize || !sizes[selectedSize]?.available)) || (product.variants.hasColors && (!selectedColor || !colors[selectedColor]?.available));
  const related = useMemo(() => allProducts.filter(item => item.id !== product.id && item.category === product.category).slice(0, 4), [allProducts, product.id, product.category]);
  const add = () => { if (!disabled) onAddToCart(product, quantity, selectedSize, selectedColor); };
  const share = async () => {
    const url = `${window.location.origin}/product/${encodeURIComponent(product.id)}`;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, text: product.name, url }); return; }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); showToast('Enlace copiado'); }
    catch { showToast('No se pudo copiar el enlace.', 'error'); }
  };
  const total = price * quantity;
  const shipping = (config.freeShippingThreshold ?? 200000) > 0 ? `Envío gratis desde ${formatCurrency(config.freeShippingThreshold ?? 200000)}` : 'Consulta el envío al hacer tu pedido.';

  return <div role="dialog" aria-modal="true" aria-labelledby="product-detail-title" className="fixed inset-0 z-[70] flex h-[100dvh] flex-col bg-white" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary, [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-pink-100 px-4 sm:px-8">
      <button ref={backRef} type="button" onClick={onClose} className="flex items-center gap-2 rounded-full py-2 pr-3 text-sm font-medium"><ArrowLeftIcon className="h-5 w-5" />Volver</button>
      <span className="truncate px-3 text-xs text-gray-500">{product.category}</span>
      <button type="button" onClick={() => void share()} aria-label="Compartir prenda" className="rounded-full p-2 text-gray-600"><ShareIcon className="h-5 w-5" /></button>
    </header>
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto grid max-w-6xl md:grid-cols-[1.1fr_1fr] md:gap-8 md:px-6 md:py-8 lg:gap-12">
        <section aria-label="Fotografías de la prenda" className="min-w-0 self-start md:sticky md:top-0">
          <div className="flex h-[48svh] min-h-[240px] items-center justify-center bg-[#fff8fb] p-3 md:h-[65vh] md:rounded-2xl">
            <ProductImage src={displayImage} alt={product.name} eager className="h-full w-full object-contain" />
          </div>
          {gallery.length > 1 && <div className="flex gap-2 overflow-x-auto px-4 py-3 md:px-0" aria-label="Elegir fotografía">
            {gallery.map((image, index) => <button key={image} type="button" onClick={() => setGalleryImage(image)} aria-label={`Ver fotografía ${index + 1}`} aria-pressed={displayImage === image} className={`h-16 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${displayImage === image ? 'border-primary' : 'border-gray-100'}`}><ProductImage src={image} alt={`Fotografía ${index + 1}`} className="h-full w-full object-cover" /></button>)}
          </div>}
        </section>
        <section className="min-w-0 px-5 pb-8 pt-5 md:px-0 md:pt-0">
          <h1 id="product-detail-title" className="font-serif text-2xl leading-tight text-gray-900 sm:text-3xl">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-2xl font-bold text-primary">{formatCurrency(price)}</span>
            {!!product.discountPercentage && <><span className="text-sm text-gray-400 line-through">{formatCurrency(product.price)}</span><span className="rounded-full bg-pink-50 px-2 py-1 text-xs font-semibold text-pink-800">-{product.discountPercentage}%</span></>}
          </div>
          <p className={`mt-2 text-xs ${product.available ? 'text-gray-500' : 'text-rose-700'}`}>{product.available ? 'Disponible' : 'Agotado'}{product.madeInColombia ? ' · Hecho en Colombia' : ''}</p>
          <div className="mt-6 space-y-5 border-t border-pink-100 pt-5">
            {product.variants.hasSizes && <fieldset><legend className="mb-3 text-sm font-semibold">Talla{selectedSize ? `: ${selectedSize}` : ''}</legend><div className="flex flex-wrap gap-2">
              {Object.entries(sizes).map(([size, variant]) => <button key={size} type="button" disabled={!variant.available} aria-pressed={selectedSize === size} onClick={() => setSelectedSize(size)} className={`min-h-11 min-w-12 rounded-lg border px-3 text-sm disabled:opacity-30 disabled:line-through ${selectedSize === size ? 'border-primary bg-pink-50 font-semibold text-pink-800' : 'border-gray-200'}`}>{size}</button>)}
            </div></fieldset>}
            {product.variants.hasColors && <fieldset><legend className="mb-3 text-sm font-semibold">Color{selectedColor ? `: ${selectedColor}` : ''}</legend><div className="flex flex-wrap gap-2">
              {Object.entries(colors).map(([color, variant]) => <button key={color} type="button" disabled={!variant.available} aria-pressed={selectedColor === color} onClick={() => { setSelectedColor(color); setGalleryImage(undefined); }} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-30 ${selectedColor === color ? 'border-primary bg-pink-50 font-semibold text-pink-800' : 'border-gray-200'}`}><span aria-hidden="true" className="h-5 w-5 rounded-full border border-gray-300" style={{ backgroundColor: getValidColor(color) }} />{color}</button>)}
            </div></fieldset>}
            <div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold">Cantidad</span><div className="flex items-center overflow-hidden rounded-xl border border-gray-200">
              <button type="button" aria-label="Disminuir cantidad" disabled={quantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))} className="p-3 disabled:opacity-30"><MinusIcon className="h-4 w-4" /></button><span aria-live="polite" className="w-9 text-center text-sm font-semibold">{quantity}</span><button type="button" aria-label="Aumentar cantidad" disabled={product.stock !== undefined && quantity >= product.stock} onClick={() => setQuantity(value => Math.min(value + 1, product.stock ?? value + 1))} className="p-3 disabled:opacity-30"><PlusIcon className="h-4 w-4" /></button>
            </div></div>
            {disabled && product.available && <p role="status" className="text-sm text-rose-700">No hay tallas o colores disponibles para esta prenda.</p>}
            <div className="hidden md:block"><button type="button" disabled={disabled} onClick={add} className="w-full rounded-xl bg-primary px-5 py-4 font-semibold text-white disabled:bg-gray-200 disabled:text-gray-500">{product.available ? `Agregar al carrito · ${formatCurrency(total)}` : 'Agotado'}</button></div>
            <p className="text-xs leading-relaxed text-gray-500">{shipping}</p>
          </div>
          <div className="mt-6 divide-y divide-pink-100 border-y border-pink-100">
            <details className="py-4" open><summary className="cursor-pointer text-sm font-semibold">Detalles de la prenda</summary><p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">{product.description || 'Consulta por WhatsApp los detalles de esta prenda.'}</p></details>
            {product.sizeGuideText?.trim() && <details className="py-4"><summary className="cursor-pointer text-sm font-semibold">Guía de tallas</summary><p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">{product.sizeGuideText}</p></details>}
            <details className="py-4"><summary className="cursor-pointer text-sm font-semibold">Medios de pago</summary>{config.paymentMethodsImageUrl && <img loading="lazy" src={config.paymentMethodsImageUrl === 'https://i.ibb.co/QPDWf6s/medios-de-pago.png' ? '/medios-pago-bombon.png' : config.paymentMethodsImageUrl} alt="Medios de pago" className="mt-3 h-auto w-full" referrerPolicy="no-referrer" />}<p className="mt-3 text-xs text-gray-500">Nequi · Daviplata · Tarjetas · Addi · Sistecrédito</p></details>
          </div>
        </section>
      </div>
      {related.length > 0 && <section className="mx-auto max-w-6xl border-t border-pink-100 px-5 py-8 sm:px-6"><h2 className="mb-5 font-serif text-xl">También te puede gustar</h2><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{related.map(item => <button key={item.id} type="button" onClick={() => onSelectProduct(item)} className="min-w-0 text-left"><ProductImage src={item.imageUrl} alt={item.name} className="aspect-[3/4] w-full rounded-xl object-cover" /><span className="mt-2 block truncate text-sm">{item.name}</span><span className="mt-1 block text-sm font-semibold text-primary">{formatCurrency(salePrice(item))}</span></button>)}</div></section>}
    </div>
    <footer className="flex shrink-0 items-center gap-3 border-t border-pink-100 bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:hidden">
      <div className="shrink-0"><p className="text-[11px] text-gray-500">Total · {quantity} {quantity === 1 ? 'prenda' : 'prendas'}</p><p className="text-lg font-bold text-primary">{formatCurrency(total)}</p></div><button type="button" disabled={disabled} onClick={add} className="min-h-12 flex-1 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-500">{product.available ? 'Agregar al carrito' : 'Agotado'}</button>
    </footer>
  </div>;
}
