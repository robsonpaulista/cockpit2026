/**
 * Service worker mínimo para critérios de PWA (instalar / atalho na tela inicial).
 * Não faz cache agressivo: repassa os pedidos à rede para não interferir no Next.js.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request).catch(() => new Response('', { status: 503, statusText: 'Offline' }))
  )
})
