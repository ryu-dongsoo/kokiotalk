self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method === 'GET' && req.url.startsWith(self.location.origin) && req.mode !== 'navigate') {
    const headers = new Headers(req.headers);
    headers.set('ngrok-skip-browser-warning', 'true');
    const modReq = new Request(req, { headers });
    e.respondWith(fetch(modReq).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(fetch(req));
});
