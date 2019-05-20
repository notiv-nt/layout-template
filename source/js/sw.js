const CACHE_VERSION = process.env.BUILD_VERSION;
const CURRENT_CACHES = {
  fontFile: `font-file-v${CACHE_VERSION}`,
};

self.addEventListener('activate', function(event) {
  const expectedCacheNames = Object.keys(CURRENT_CACHES).map(function(key) {
    return CURRENT_CACHES[key];
  });

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (expectedCacheNames.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  // Cache font
  if (/https:\/\/fonts.gstatic.com/.test(event.request.url)) {
    return event.respondWith(cacheFont(event.request));
  }

  return event;
});

async function cacheFont(request) {
  const cache = await caches.open(CURRENT_CACHES.fontFile);
  const inCache = await cache.match(request);

  if (inCache) {
    return inCache;
  }

  const response = await fetch(request);

  cache.put(request, response.clone());

  return response;
}
