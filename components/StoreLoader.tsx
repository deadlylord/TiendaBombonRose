import React from 'react';

const GarmentRail = () => <svg width="320" height="112" viewBox="0 0 320 112" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
  <g transform="translate(4 0)">
    <path d="M32 21c0-9 12-9 12-2 0 4-6 5-6 9v3L15 43h46L38 31" />
    <path d="m23 40-13 8 8 16 9-5-3 38h28l-3-38 9 5 8-16-13-8M30 41q8 11 16 0" />
  </g>
  <g transform="translate(84 0)">
    <path d="M32 21c0-9 12-9 12-2 0 4-6 5-6 9v3L15 43h46L38 31" />
    <path d="m28 40-4 17 9 12-16 29h42L43 69l9-12-4-17M33 69h10M28 55q10 9 24 0" />
  </g>
  <g transform="translate(164 0)">
    <path d="M32 21c0-9 12-9 12-2 0 4-6 5-6 9v3L15 43h46L38 31" />
    <path d="M23 43h30l4 55H42l-4-34-4 34H19l4-55ZM23 50h30M38 50v14M27 50v8M49 50v8" />
  </g>
  <g transform="translate(244 0)">
    <path d="M32 21c0-9 12-9 12-2 0 4-6 5-6 9v3L15 43h46L38 31" />
    <path d="m26 40-13 9-5 38 12 2 6-26-2 34h28l-2-34 6 26 12-2-5-38-13-9M33 41l5 13 5-13M38 54v43M29 77h5M43 77h5" />
  </g>
</svg>;

const StoreLoader: React.FC<{ failed?: boolean }> = ({ failed = false }) => (
  <div className="store-startup" role={failed ? 'alert' : 'status'} aria-live="polite" aria-label={failed ? 'No se pudo iniciar la tienda' : 'Cargando tienda Bombón'}>
    <div className="store-startup__content">
      {!failed && <div className="store-startup__wardrobe" aria-hidden="true"><div className="store-startup__rail" /><div className="store-startup__carousel"><GarmentRail /><GarmentRail /></div></div>}
      <p className="store-startup__message">{failed ? 'No pudimos abrir la tienda. Revisa tu conexión e intenta de nuevo.' : 'Descubre tu próximo outfit'}</p>
      {failed && <button className="store-startup__retry" onClick={() => window.location.reload()}>Volver a intentar</button>}
    </div>
  </div>
);

export default StoreLoader;
