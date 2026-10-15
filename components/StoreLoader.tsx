import React from 'react';

const StoreLoader: React.FC<{ failed?: boolean }> = ({ failed = false }) => (
  <div className="store-startup" role={failed ? 'alert' : 'status'} aria-live="polite" aria-label={failed ? 'No se pudo iniciar la tienda' : 'Cargando tienda Bombón'}>
    <div className="store-startup__content">
      <div className={`store-startup__mark${failed ? ' store-startup__mark--paused' : ''}`} aria-hidden="true">
        <span className="store-startup__ring" />
        <span className="store-startup__letter">B</span>
      </div>
      <p className="store-startup__brand">Bombón</p>
      <p className="store-startup__slogan">Ponte bonita para ti.</p>
      <p className="store-startup__message">{failed ? 'No pudimos abrir la tienda. Revisa tu conexión e intenta de nuevo.' : 'Cargando tienda…'}</p>
      {failed
        ? <button className="store-startup__retry" onClick={() => window.location.reload()}>Volver a intentar</button>
        : <div className="store-startup__dots" aria-hidden="true"><span /><span /><span /></div>}
    </div>
  </div>
);

export default StoreLoader;
