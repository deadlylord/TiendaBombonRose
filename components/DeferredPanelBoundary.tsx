import React from 'react';

export default class DeferredPanelBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="fixed inset-0 z-[90] bg-white flex flex-col gap-4 items-center justify-center p-6 text-center">
      <h2 className="text-xl font-semibold">No pudimos abrir la administración</h2>
      <p>Recarga la página para descargar la versión actual.</p>
      <button className="bg-primary text-white rounded-lg px-5 py-3" onClick={() => window.location.reload()}>Recargar</button>
      <a href="/" className="text-primary underline">Volver a la tienda</a>
    </div>;
  }
}
