const IMAGE_CACHE = 'notteshe-images-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== IMAGE_CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Never cache JS/CSS/HTML — avoids stale files after deploys
  if (sameOrigin && (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'document'
  )) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache images only
  if (sameOrigin && request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        cache.put(request, fresh.clone());
        return fresh;
      })
    );
    return;
  }

  // Offline fallback for navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => new Response(
        '<h1>Offline</h1><p>Please check your internet connection.</p>',
        { headers: { 'Content-Type': 'text/html' } }
      ))
    );
    return;
  }

  event.respondWith(fetch(request));
});
