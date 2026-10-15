import test from 'node:test';
import assert from 'node:assert/strict';
import { createBannerImageLoader } from '../services/bannerImages';

test('Banner downloads are shared and remain pending until the image is decoded', async () => {
  let decoded!: () => void;
  const decoding = new Promise<void>(resolve => { decoded = resolve; });
  const images: HTMLImageElement[] = [];
  const load = createBannerImageLoader(() => {
    const image = { decode: () => decoding } as HTMLImageElement;
    images.push(image); return image;
  });
  const first = load('photo.jpg', 'high');
  assert.equal(load('photo.jpg'), first);
  assert.equal(images.length, 1);
  assert.equal(images[0].fetchPriority, 'high');
  assert.equal(images[0].referrerPolicy, 'no-referrer');
  let ready = false;
  void first.then(() => { ready = true; });
  images[0].onload?.call(images[0], {} as Event);
  await Promise.resolve();
  assert.equal(ready, false);
  decoded(); await first;
  assert.equal(ready, true);
  assert.equal(load('photo.jpg'), first);
});

test('A failed image can be downloaded again instead of caching a permanent failure', async () => {
  const images: HTMLImageElement[] = [];
  const load = createBannerImageLoader(() => {
    const image = { decode: () => Promise.resolve() } as HTMLImageElement;
    images.push(image); return image;
  });
  const first = load('photo.jpg');
  images[0].onerror?.call(images[0], {} as Event);
  await assert.rejects(first);
  const retry = load('photo.jpg');
  assert.notEqual(retry, first);
  assert.equal(images.length, 2);
  images[1].onload?.call(images[1], {} as Event);
  await retry;
});
