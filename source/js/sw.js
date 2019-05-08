const CACHE_VERSION = process.env.BUILD_VERSION;
const CURRENT_CACHES = {
  fontFile: `font-file-v${CACHE_VERSION}`,
  fontCss: `font-css-v${CACHE_VERSION}`,
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
  // Polyfill
  if (/https:\/\/fonts.googleapis.com\/css/.test(event.request.url)) {
    return event.respondWith(fontDisplayPolyfill(event.request));
  }

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

async function fontDisplayPolyfill(request) {
  const cache = await caches.open(CURRENT_CACHES.fontCss);
  const inCache = await cache.match(request);

  if (inCache) {
    return inCache;
  }

  const response = await fetch(request.url);
  let css = await response.text();

  if (css.search('font-display') === -1) {
    css = css.replace(/}/g, 'font-display: swap; }');
  }

  const newResponse = new Response(css, {
    headers: response.headers,
  });

  cache.put(request, newResponse.clone());

  return newResponse;
}
