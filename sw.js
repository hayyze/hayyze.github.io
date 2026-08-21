const CACHE_NAME = 'heez-v1.2.0';

const ASSETS = [
  './',
  './index.html',
  './pomodoro.html',
  './todo.html',
  './gpa.html',
  './notes.html',
  './draw.html',
  './habits.html',
  './calculator.html',
  './game.html',
  './blog.html',
  './about.html',
  './style.css',
  './common.js',
  './summary.js',
  './pomodoro.js',
  './todo.js',
  './gpa.js',
  './notes.js',
  './habits.js',
  './calculator.js',
  './game.js',
  './words.json',
  './pdf.min.js',
  './pdf.worker.min.js',
  './manifest.webmanifest',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png',
  './favicon.ico',
  './favicon-32x32.png',
  './apple-touch-icon.png'
];

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
          if (response && response.status === 200) {
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
          }

          return response;
        })
        .catch(() => {
          return caches.match(request);
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

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        const accept = request.headers.get('accept') || '';

        if (accept.includes('text/html')) {
          return caches.match('./index.html');
        }

        return new Response('', {
          status: 503,
          statusText: 'Offline'
        });
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
            client.url.includes('pomodoro.html') &&
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