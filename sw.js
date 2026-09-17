// Service worker único do app — junta duas responsabilidades:
// 1) Viabilizar a instalação como PWA (cache mínimo, sem agressividade — o app
//    depende de dados em tempo real do Firestore, cachear demais desatualizaria).
// 2) Tratar as push notifications (Firebase Cloud Messaging) em segundo plano.
// IMPORTANTE: só pode existir UM service worker registrado na raiz do site — dois
// arquivos separados (sw.js e firebase-messaging-sw.js) entram em conflito e só um
// fica realmente ativo, fazendo o outro simplesmente não fazer nada.

importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAGuDCbOQfVpkj-jPJzglCgPNZE5P8lxRc",
  authDomain: "agenda-pabloframess-72769.firebaseapp.com",
  projectId: "agenda-pabloframess-72769",
  storageBucket: "agenda-pabloframess-72769.firebasestorage.app",
  messagingSenderId: "512997093150",
  appId: "1:512997093150:web:ddd833425994c90129a30f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Usa "data" (não "notification") de propósito: quando a mensagem tem campo
  // "notification", o navegador mostra uma notificação AUTOMÁTICA sozinho, além
  // dessa aqui que montamos na mão — resultado: duas notificações pra mesma mensagem
  // (bug/comportamento documentado do Firebase, reproduzível principalmente no Safari).
  const d = payload.data || {};
  const titulo = d.title || 'Agenda dos Fotógrafos';
  const tag = payload.messageId || payload.collapseKey || (titulo + (d.body || ''));
  const opcoes = {
    body: d.body || '',
    icon: 'https://i.imgur.com/th7jUdY.png',
    badge: 'https://i.imgur.com/th7jUdY.png',
    data: { link: d.link || '/index.html' },
    tag
  };
  self.registration.showNotification(titulo, opcoes);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/index.html';
  event.waitUntil(clients.openWindow(link));
});

const CACHE_NAME = 'agenda-fotografos-v2';
const ARQUIVOS_ESTATICOS = [
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/logo-transparente.png'
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

// Estratégia: mostra a versão salva NA HORA (rápido), e atualiza o cache por trás
// pra próxima visita já vir com a versão mais nova. Isso é seguro aqui porque os
// dados da agenda (eventos, clientes, etc.) não passam por esse cache — eles vêm
// direto do Firestore em tempo real, por uma conexão própria, sempre atualizados.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cacheado = await cache.match(event.request);
      const buscaRede = fetch(event.request).then((resp) => {
        if (resp && resp.status === 200) cache.put(event.request, resp.clone());
        return resp;
      }).catch(() => cacheado);
      return cacheado || buscaRede;
    })
  );
});
