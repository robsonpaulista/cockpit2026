/* Cache leve para uso offline após primeira visita (shell /pesquisador) */
const CACHE = 'pesquisador-shell-v1'
const PRECACHE = ['/pesquisador', '/pesquisador/login']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (!url.pathname.startsWith('/pesquisador')) return
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((r) => r || caches.match('/pesquisador')))
  )
})
