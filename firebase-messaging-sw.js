// Service worker do Firebase Cloud Messaging — trata as notificações push que chegam
// mesmo com o app fechado/em segundo plano. Fica separado do sw.js principal porque
// o FCM exige que esse arquivo específico exista na raiz do site com esse nome.
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
