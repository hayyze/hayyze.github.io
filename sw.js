const CACHE_NAME = 'heez-v1.11.4';

const ASSETS = [
  './',
  './index.html',
  './subject.html',
  './pomodoro.html',
  './todo.html',
  './gpa.html',
  './intermediate.html',
  './secondary.html',
  './university.html',
  './first-intermediate.html',
  './second-intermediate.html',
  './third-intermediate.html',
  './first-secondary.html',
  './second-secondary.html',
  './third-secondary.html',
  './cumulative.html',
  './weighted.html',
  './required-score.html',
  './notes.html',
  './draw.html',
  './habits.html',
  './calculator.html',
  './game.html',
  './blog.html',
  './blog-16.html',
  './about.html',
  './contact.html',
  './terms.html',
  './privacy.html',
  './founder.html',
  './style.css',
  './common.js',
  './account-storage.js',
  './focus-history.js',
  './backup.js',
  './account-import.js',
  './analytics.js',
  './summary.js',
  './day-planning.js',
  './study-planner.html',
  './study-planner.css',
  './study-planner.js',
  './workspaces.html',
  './spaces.js',
  './spaces-realtime-runtime.js',
  './pdf.min.js',
  './pdf.worker.min.js',
  './supabase.js',
  './sync.js',
  './auth-ui.js',
  './pomodoro.js',
  './todo.js',
  './subject.js',
  './gpa.js',
  './notes.js',
  './habits.js',
  './calculator.js',
  './game.js',
  './words.json',
  './manifest.webmanifest',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png',
  './favicon.ico',
  './favicon-32x32.png',
  './apple-touch-icon.png'
];

// The HTML cache is a static app shell. Task IDs, OAuth parameters and other
// query strings belong to the open document, never to separate cached copies.
const APP_BASE = new URL('./', self.location.href);
const ASSET_URLS = new Set(ASSETS.map((asset) => new URL(asset, APP_BASE).href));
const HTML_ROUTES = new Map();
ASSETS.filter((asset) => asset.endsWith('.html')).forEach((asset) => {
  const url = new URL(asset, APP_BASE);
  HTML_ROUTES.set(url.pathname, url.href);
  HTML_ROUTES.set(url.pathname.slice(0, -5), url.href);
});
HTML_ROUTES.set(APP_BASE.pathname, new URL('./index.html', APP_BASE).href);

function htmlCacheKey(request) {
  const url = new URL(typeof request === 'string' ? request : request.url, APP_BASE);
  return url.origin === APP_BASE.origin ? HTML_ROUTES.get(url.pathname) || null : null;
}

function documentResponse(response) {
  // Cache.addAll follows Pages' .html redirects. A redirected cached Response
  // cannot be returned for every navigation redirect mode, so remove only that
  // transport flag; the document bytes, status and security headers stay intact.
  return response && response.redirected
    ? new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers })
    : response;
}

function offlineResponse() {
  return new Response('تعذر فتح هذه الصفحة دون اتصال. أعد المحاولة عند عودة الإنترنت.', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

function keepCached(event, key, response) {
  if (!key || !response || response.status !== 200) return;
  const copy = response.clone();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(key, copy)).catch(() => {}));
}

// تثبيت Service Worker وتخزين الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// تفعيل Service Worker وتنظيف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

// التعامل مع الطلبات
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);
  // Remote auth/data endpoints must keep their normal network semantics.
  if (url.origin !== APP_BASE.origin) return;
  const documentKey = request.destination === 'document' ? htmlCacheKey(request) : null;

  /*
   * HTML + JavaScript + CSS
   * Network First:
   * نحاول دائمًا الحصول على أحدث نسخة من الشبكة.
   * إذا لم يوجد إنترنت، نستخدم النسخة الموجودة في الكاش.
   */
  if (
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          keepCached(event, documentKey || (ASSET_URLS.has(url.href) ? request : null), response);
          return response;
        })
        .catch(async () => {
          if (request.destination === 'document' && !documentKey) return offlineResponse();
          const cached = await caches.match(documentKey || request);
          return (request.destination === 'document' ? documentResponse(cached) : cached) || offlineResponse();
        })
    );

    return;
  }

  /*
   * باقي الملفات:
   * Cache First:
   * إذا كانت موجودة في الكاش نستخدمها.
   * وإذا لم تكن موجودة، نحاول تحميلها من الشبكة وتخزينها.
   */
  if (!ASSET_URLS.has(url.href)) return;
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request)
          .then((response) => {
            if (
              !response ||
              response.status !== 200 ||
              response.type !== 'basic'
            ) {
              return response;
            }

            keepCached(event, request, response);
            return response;
          });
      })
      .catch(() => {
        return offlineResponse();
      })
  );
});

// دعم النقر على إشعارات بومودورو
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
      .then((clientList) => {
        for (const client of clientList) {
          if (
            htmlCacheKey(client.url) === new URL('./pomodoro.html', APP_BASE).href &&
            'focus' in client
          ) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow('./pomodoro.html');
        }
      })
  );
});
