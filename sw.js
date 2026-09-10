// Service worker mínimo — o objetivo aqui não é cache agressivo (o app depende de
// dados em tempo real do Firestore, cachear demais causaria dados desatualizados),
// é só satisfazer o requisito do navegador pra permitir "Instalar app".
const CACHE_NAME = 'agenda-fotografos-v1';
const ARQUIVOS_ESTATICOS = [
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_ESTATICOS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Estratégia: tenta a rede primeiro (dados sempre atualizados); só usa o cache
// se estiver offline. Isso evita mostrar agenda desatualizada por engano.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
