import React from 'react';
import ReactDOM from 'react-dom/client';
import StoreLoader from './components/StoreLoader';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element with ID "root" not found in the document.');
}

const root = ReactDOM.createRoot(rootElement);
root.render(<StoreLoader />);

// Keep the startup screen visible while the application module downloads.
void import('./App').then(({ default: App }) => {
  root.render(<React.StrictMode><App /></React.StrictMode>);
}).catch(error => {
  console.error('No se pudo iniciar la tienda:', error);
  root.render(<StoreLoader failed />);
});
