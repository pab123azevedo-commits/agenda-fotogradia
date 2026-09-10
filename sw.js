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
  const titulo = payload.notification?.title || 'Agenda dos Fotógrafos';
  const opcoes = {
    body: payload.notification?.body || '',
    icon: 'https://i.imgur.com/th7jUdY.png',
    badge: 'https://i.imgur.com/th7jUdY.png'
  };
  self.registration.showNotification(titulo, opcoes);
});

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
