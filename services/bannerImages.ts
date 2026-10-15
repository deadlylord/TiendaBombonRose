type BannerImage = Pick<HTMLImageElement, 'src' | 'onload' | 'onerror' | 'decode' | 'decoding' | 'fetchPriority' | 'referrerPolicy'>;

// Share downloads between the visible banner and the next slide's preload.
export function createBannerImageLoader(makeImage: () => BannerImage) {
  const requests = new Map<string, Promise<void>>();
  return (url: string, priority: 'high' | 'low' = 'low'): Promise<void> => {
    const existing = requests.get(url);
    if (existing) return existing;
    const request = new Promise<void>((resolve, reject) => {
      const image = makeImage();
      image.decoding = 'async';
      image.fetchPriority = priority;
      image.referrerPolicy = 'no-referrer';
      image.onload = () => {
        void (image.decode ? image.decode() : Promise.resolve()).then(resolve, reject);
      };
      image.onerror = () => reject(new Error('No se pudo descargar el banner.'));
      image.src = url;
    });
    requests.set(url, request);
    void request.catch(() => { if (requests.get(url) === request) requests.delete(url); });
    return request;
  };
}

export const loadBannerImage = createBannerImageLoader(() => new Image());
