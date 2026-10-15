interface StartupHost {
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  document: { getElementById: (id: string) => { remove: () => void } | null };
}

export function createStartupReveal(host: StartupHost) {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    // Keep the original loading DOM through React's commit and the next layout.
    host.requestAnimationFrame(() => host.requestAnimationFrame(() => {
      host.document.getElementById('store-startup-screen')?.remove();
    }));
  };
}

let reveal: (() => void) | undefined;
export function revealStorefront() {
  reveal ??= createStartupReveal(window);
  reveal();
}
