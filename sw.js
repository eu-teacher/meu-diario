// Kill-switch service worker
// Limpa TODAS as caches antigas, desregistra a si mesmo,
// e força reload de todas as abas abertas (inclusive PWA instalado).
// Após isso, o app passa a rodar 100% sem service worker.
self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    try {
      // 1) Apaga todas as caches existentes
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      // 2) Desregistra a si mesmo
      await self.registration.unregister();
      // 3) Força recarregar todas as abas/PWAs abertos
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const c of clients) {
        try { c.navigate(c.url); } catch {}
      }
    } catch (err) {}
  })());
  self.clients.claim();
});

// Sem fetch handler: tudo passa direto pra rede.
