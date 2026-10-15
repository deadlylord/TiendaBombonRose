import { useEffect, useMemo, useState } from 'react';
import type { Banner, Category } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { loadBannerImage } from '../services/bannerImages';

export default function BannerCarousel({ banners, loading = false, onNavigateToCategory, isMenTheme }: {
  banners: Banner[];
  loading?: boolean;
  onNavigateToCategory: (category: Category) => void;
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

  return <section aria-label="Colecciones destacadas" aria-busy={loading || (pending && !!requested)}>
    <div className="relative mx-auto aspect-[2/3] max-h-[80vh] w-full overflow-hidden bg-[#fff5f8] md:aspect-[8/5]">
      {displayed && <img src={displayed.imageUrl} alt={displayed.title || 'Colección Bombón'} decoding="async" fetchPriority="high" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain" />}
      {!displayed && <div role="status" className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-gray-500">
        {loading || (requested && pending) ? 'Cargando colección…' : error ? 'No se pudo cargar la imagen.' : 'Pronto encontrarás nuevas colecciones aquí.'}
      </div>}
      {error && <div role="alert" className="absolute inset-x-12 bottom-4 rounded-xl bg-white/95 p-3 text-center text-xs text-gray-600">La imagen no está disponible. <button type="button" onClick={() => setRetry(value => value + 1)} className="font-semibold text-pink-700 underline">Reintentar</button></div>}
      {slides.length > 1 && <>
        <button type="button" aria-label="Banner anterior" onClick={() => setIndex(value => (value - 1 + slides.length) % slides.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-sm"><ChevronLeftIcon className="h-6 w-6" /></button>
        <button type="button" aria-label="Banner siguiente" onClick={() => setIndex(value => (value + 1) % slides.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-sm"><ChevronRightIcon className="h-6 w-6" /></button>
      </>}
    </div>
    <div className="min-h-[160px] bg-white px-5 py-5 text-center">
      {caption && <>
      {caption.title && <h2 className="font-serif text-2xl text-on-surface sm:text-3xl">{caption.title}</h2>}
      {caption.subtitle && <p className="mt-2 text-sm text-gray-600 sm:text-base">{caption.subtitle}</p>}
      <a href={caption.link.startsWith('category:') ? '#productos' : caption.link} onClick={event => {
        if (caption.link.startsWith('category:')) { event.preventDefault(); onNavigateToCategory(caption.link.slice('category:'.length)); }
      }} className={`mt-4 inline-block rounded-full px-7 py-3 font-semibold text-white ${isMenTheme ? 'cyber-gradient-bg' : 'bg-primary hover:bg-primary-dark'}`}>Ver colección</a>
      </>}
    </div>
  </section>;
}
