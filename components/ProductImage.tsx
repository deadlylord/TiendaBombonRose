import { useState } from 'react';
import { ShoppingBagIcon } from './Icons';

export default function ProductImage({ src, alt, className = '', eager = false }: { src?: string; alt: string; className?: string; eager?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | undefined>();
  if (!src || failedSource === src) return <div role="img" aria-label={`${alt}: fotografía no disponible`} className={`${className} flex flex-col items-center justify-center gap-2 bg-gray-100 text-gray-500`}>
    <ShoppingBagIcon className="h-10 w-10" /><span className="text-center text-xs">Fotografía no disponible</span>
  </div>;
  return <img src={src} alt={alt} className={className} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setFailedSource(src)} />;
}
