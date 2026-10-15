import React from 'react';

const StoreLoader: React.FC<{ failed?: boolean }> = ({ failed = false }) => (
  <div className="store-startup" role={failed ? 'alert' : 'status'} aria-live="polite" aria-label={failed ? 'No se pudo iniciar la tienda' : 'Cargando tienda Bombón'}>
    <div className="store-startup__content">
      {!failed && <svg className="store-startup__spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="store-startup__track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="store-startup__segment" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>}
      <p className="store-startup__message">{failed ? 'No pudimos abrir la tienda. Revisa tu conexión e intenta de nuevo.' : 'Descubre tu próximo outfit'}</p>
      {failed && <button className="store-startup__retry" onClick={() => window.location.reload()}>Volver a intentar</button>}
    </div>
  </div>
);

export default StoreLoader;
