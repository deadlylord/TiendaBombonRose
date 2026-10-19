import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import type { Banner, Category } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { bannerDestination } from '../services/bannerDestinations';
import { loadBannerImage } from '../services/bannerImages';

export default function BannerCarousel({ banners, loading = false, onNavigateToCategory, onNavigateToProduct, onViewCatalog, onNavigateToCollection, onInitialReady }: {
  banners: Banner[];
  loading?: boolean;
  onNavigateToCategory: (category: Category) => void;
  onNavigateToProduct: (id: string) => void;
  onViewCatalog: () => void;
  onNavigateToCollection: (id: string) => void;
  onInitialReady?: () => void;
  isMenTheme?: boolean;
}) {
  const slides = useMemo(() => banners.filter(banner => banner.imageUrl?.trim()), [banners]);
  const signature = JSON.stringify(slides.map(slide => [slide.id, slide.imageUrl]));
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState<{ signature: string; banner: Banner } | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const displayed = shown?.signature === signature ? shown.banner : null;
  const requested = slides[index % slides.length];
  const caption = displayed || requested;
  const destination = bannerDestination(caption?.link || '');

  useEffect(() => {
    if (loading) return;
    if (slides.length === 0 || displayed || error) { onInitialReady?.(); return; }
    // A slow external image must not keep the rest of the shop covered forever.
    const timer = window.setTimeout(() => onInitialReady?.(), 6000);
    return () => window.clearTimeout(timer);
  }, [loading, slides.length, displayed, error, onInitialReady]);

  useEffect(() => { setIndex(0); }, [signature]);
  useEffect(() => {
    if (!requested) return;
    let active = true;
    setPending(true); setError(false);
    void loadBannerImage(requested.imageUrl, 'high').then(() => {
      if (!active) return;
      setShown({ signature, banner: requested }); setPending(false);
      const next = slides[(index + 1) % slides.length];
      if (next && next.imageUrl !== requested.imageUrl) void loadBannerImage(next.imageUrl).catch(() => {});
    }, () => { if (active) { setPending(false); setError(true); } });
    return () => { active = false; };
  }, [requested, signature, retry, slides, index]);

  useEffect(() => {
    if (slides.length < 2 || pending || error || !displayed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => setIndex(value => (value + 1) % slides.length), 6500);
    return () => window.clearTimeout(timer);
  }, [slides.length, pending, error, displayed, index]);

  const handleDestinationClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (destination.kind === 'category') { event.preventDefault(); onNavigateToCategory(destination.category); }
        else if (destination.kind === 'collection') { event.preventDefault(); onNavigateToCollection(destination.collectionId); }
        else if (destination.kind === 'product') { event.preventDefault(); onNavigateToProduct(destination.productId); }
        else if (destination.kind === 'catalog') { event.preventDefault(); onViewCatalog(); }

  };

  return <section aria-label="Colecciones destacadas" aria-busy={loading || (pending && !!requested)}>
    <div className={`relative mx-auto aspect-[2/3] max-h-[80vh] w-full overflow-hidden md:aspect-[8/5] ${displayed || error ? 'bg-[#fff5f8]' : 'bg-white'}`}>
      {displayed && (destination.kind !== 'none' ? <a href={destination.href} onClick={handleDestinationClick} aria-label={destination.kind === 'product' ? 'Ver prenda del banner' : 'Ver colección del banner'} className="absolute inset-0"><img src={displayed.imageUrl} alt={displayed.title || 'Colección Bombón'} decoding="async" fetchPriority="high" referrerPolicy="no-referrer" className="h-full w-full object-contain" /></a> : <img src={displayed.imageUrl} alt={displayed.title || 'Colección Bombón'} decoding="async" fetchPriority="high" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain" />)}
      {!displayed && <div role="status" aria-label="Cargando imagen principal" className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-gray-500">
        {loading || (requested && pending) ? null : error ? 'No se pudo cargar la imagen.' : 'Pronto encontrarás nuevas colecciones aquí.'}
      </div>}
      {error && <div role="alert" className="absolute inset-x-12 bottom-4 rounded-xl bg-white/95 p-3 text-center text-xs text-gray-600">La imagen no está disponible. <button type="button" onClick={() => setRetry(value => value + 1)} className="font-semibold text-pink-700 underline">Reintentar</button></div>}
      {displayed && caption && destination.kind !== 'none' && <a href={destination.href} onClick={handleDestinationClick} className="absolute left-1/2 top-1/2 max-w-[calc(100%-112px)] -translate-x-1/2 -translate-y-1/2 break-words rounded-full border border-[#E91E8C]/40 bg-white/55 px-7 py-3 text-center text-sm font-semibold text-[#E91E8C] backdrop-blur-[3px] transition-colors hover:bg-white/75 sm:px-9 sm:py-4 sm:text-base">{caption.buttonText?.trim() || (destination.kind === 'product' ? 'Ver prenda' : 'Ver colección')}</a>}
      {slides.length > 1 && <>
        <button type="button" aria-label="Banner anterior" onClick={() => setIndex(value => (value - 1 + slides.length) % slides.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-transparent p-2 text-[#E91E8C] transition-colors hover:bg-pink-50/30"><ChevronLeftIcon className="h-6 w-6" /></button>
        <button type="button" aria-label="Banner siguiente" onClick={() => setIndex(value => (value + 1) % slides.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-transparent p-2 text-[#E91E8C] transition-colors hover:bg-pink-50/30"><ChevronRightIcon className="h-6 w-6" /></button>
      </>}
    </div>
  </section>;
}
