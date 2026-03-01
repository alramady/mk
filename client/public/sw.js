// Build version is injected at build time or bumped manually on each deploy
const BUILD_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = 'monthly-key-v3-' + BUILD_VERSION;
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// Install - cache shell + force immediate activation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Skip waiting to activate immediately (don't wait for old tabs to close)
  self.skipWaiting();
});

// Activate - AGGRESSIVELY clean ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      console.log('[SW] Activated with cache:', CACHE_NAME);
      // Claim all clients immediately so the new SW controls all tabs
      return self.clients.claim();
    })
  );
});

// Fetch - network first, fallback to cache
// For HTML navigation requests: ALWAYS go to network (never serve stale HTML)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;
  if (event.request.url.includes('/trpc/')) return;

  // Skip cross-origin requests (e.g., R2 storage images, external CDNs).
  // Let the browser handle them directly via img-src CSP — avoids
  // connect-src blocking SW fetch() for cross-origin image URLs.
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // For navigation requests (HTML pages), always network-first with no cache fallback
  // This prevents stale SPA shells from being served
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('/')))
    );
    return;
  }

  // For other assets (JS, CSS, images): network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ─── Push Notifications ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/icon-72x72.png',
      tag: data.tag || 'default',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: 'فتح' },
        { action: 'close', title: 'إغلاق' },
      ],
      dir: 'rtl',
      lang: 'ar',
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'المفتاح الشهري', options)
    );
  } catch (e) {
    event.waitUntil(
      self.registration.showNotification('المفتاح الشهري', {
        body: event.data.text(),
        icon: '/icons/icon-192x192.png',
        dir: 'rtl',
        lang: 'ar',
      })
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options).then((subscription) => {
      return fetch('/api/trpc/push.subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
          },
        }),
      });
    })
  );
});

// ─── Message handler for version checks ──────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: BUILD_VERSION, cache: CACHE_NAME });
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
