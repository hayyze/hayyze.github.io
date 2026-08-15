const CACHE_NAME = 'heez-v1.0.0';
const ASSETS = [
  './',
  './index.html',
  './pomodoro.html',
  './todo.html',
  './gpa.html',
  './notes.html',
  './habits.html',
  './game.html',
  './blog.html',
  './about.html',
  './style.css',
  './common.js',
  './pomodoro.js',
  './todo.js',
  './gpa.js',
  './notes.js',
  './habits.js',
  './game.js',
  './words.json',
  './manifest.webmanifest',
  './android-chrome-192x192.png',
  './android-chrome-512x512.png',
  './favicon.ico',
  './favicon-32x32.png',
  './apple-touch-icon.png'
];

// تثبيت الـ Service Worker وتخزين الملفات
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

// تفعيل وتنظيف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// استراتيجية: Cache First مع Network Fallback
self.addEventListener('fetch', (event) => {
  // نتجاهل طلبات غير GET وطلبات خارجية
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          // نخزن فقط الاستجابات الناجحة من نفس الأصل
          if (
            !response ||
            response.status !== 200 ||
            response.type !== 'basic'
          ) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
       const accept = event.request.headers.get('accept') || '';

         if (accept.includes('text/html')) {
         return caches.match('./index.html');
           }
        });
    })
  );
});

// دعم النقر على الإشعارات (من الكود القديم)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('pomodoro.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./pomodoro.html');
      }
    })
  );
});
