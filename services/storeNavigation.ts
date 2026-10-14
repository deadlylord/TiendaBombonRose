interface NavigationEntry { id: number; parentId?: number; scrollY: number }
interface HistoryState { [key: string]: unknown; bombonNavigation?: NavigationEntry }

export interface NavigationBrowser {
  history: {
    state: HistoryState | null;
    scrollRestoration: 'auto' | 'manual';
    pushState: (state: HistoryState, title: string, path: string) => void;
    replaceState: (state: HistoryState, title: string, path?: string) => void;
    back: () => void;
  };
  location: { pathname: string };
  readonly scrollY: number;
  scrollTo: (options: ScrollToOptions) => void;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame: (id: number) => void;
  addEventListener: (type: 'popstate', callback: () => void) => void;
  removeEventListener: (type: 'popstate', callback: () => void) => void;
}

// Each overlay is a real history entry. Closing it uses the same path as native Back.
export function createStoreNavigation(browser: NavigationBrowser, onPath: (path: string) => void) {
  let nextId = Date.now();
  let frame = 0;
  const previousRestoration = browser.history.scrollRestoration;
  browser.history.scrollRestoration = 'manual';
  if (!browser.history.state?.bombonNavigation) {
    browser.history.replaceState({ ...browser.history.state, bombonNavigation: { id: nextId++, scrollY: browser.scrollY } }, '');
  }
  const restoreScroll = (top: number) => {
    browser.cancelAnimationFrame(frame);
    frame = browser.requestAnimationFrame(() => {
      frame = browser.requestAnimationFrame(() => browser.scrollTo({ top, behavior: 'instant' }));
    });
  };
  const onPopState = () => {
    onPath(browser.location.pathname);
    restoreScroll(browser.history.state?.bombonNavigation?.scrollY ?? 0);
  };
  browser.addEventListener('popstate', onPopState);

  return {
    navigate(path: string) {
      if (path === browser.location.pathname) return;
      browser.cancelAnimationFrame(frame);
      const previous = browser.history.state?.bombonNavigation || { id: nextId++, scrollY: browser.scrollY };
      browser.history.replaceState({ ...browser.history.state, bombonNavigation: { ...previous, scrollY: browser.scrollY } }, '');
      browser.history.pushState({ bombonNavigation: { id: nextId++, parentId: previous.id, scrollY: browser.scrollY } }, '', path);
      onPath(path);
    },
    close() {
      if (browser.history.state?.bombonNavigation?.parentId !== undefined) {
        browser.history.back();
      } else {
        // A shared product URL has no in-store parent; the close button returns to the catalog.
        browser.history.replaceState({ ...browser.history.state, bombonNavigation: { id: nextId++, scrollY: 0 } }, '', '/');
        onPath('/');
        restoreScroll(0);
      }
    },
    dispose() {
      browser.removeEventListener('popstate', onPopState);
      browser.cancelAnimationFrame(frame);
      browser.history.scrollRestoration = previousRestoration;
    },
  };
}
