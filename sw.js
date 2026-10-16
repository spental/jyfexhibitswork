// Cache only the interface shell. Authentication and work orders always require a connection.
const CACHE = 'fielddesk-shell-v1';
const SHELL = ['./', './index.html', './styles.css', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('fielddesk-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  const url = new URL(request.url);
  // Never cache configuration or authenticated data. Use the network for scripts and dynamic content.
  if (!['/', '/index.html', '/styles.css'].some(path => url.pathname.endsWith(path)) && !url.pathname.includes('/icons/')) return;
  event.respondWith(fetch(request).then(response => { if(response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; }).catch(() => caches.match(request)));
});
