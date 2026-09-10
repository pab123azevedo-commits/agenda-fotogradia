// lib/firebaseAdmin.js
// Helper compartilhado pelas funções em api/. Fica FORA da pasta api/ de propósito —
// o Vercel trata todo arquivo dentro de api/ como uma rota pública, e esse aqui não é.

const { initializeApp, cert, getApps } = require('firebase-admin/app');

// Normaliza a chave privada do Firebase mesmo se ela tiver sido colada "achatada"
// numa linha só (perdendo as quebras de linha), o que é um erro comum ao copiar
// esse tipo de valor entre painéis (Netlify → Vercel, por exemplo).
function normalizarChavePrivada(raw) {
  if (!raw) return raw;
  let key = raw.trim();

  // Se vier com \n escapado como texto literal, converte pra quebra de linha real
  key = key.replace(/\\n/g, '\n');

  // Se mesmo assim não tiver nenhuma quebra de linha real, a chave foi colada
  // achatada — reconstrói o formato PEM: cabeçalho, corpo em blocos de 64
  // caracteres (padrão PEM), rodapé.
  if (!key.includes('\n')) {
    const match = key.match(/-----BEGIN PRIVATE KEY-----(.*)-----END PRIVATE KEY-----/);
    if (match) {
      const corpo = match[1].replace(/\s/g, '');
      const linhas = corpo.match(/.{1,64}/g) || [];
      key = `-----BEGIN PRIVATE KEY-----\n${linhas.join('\n')}\n-----END PRIVATE KEY-----\n`;
    }
  }
  return key;
}

function getFirebaseAdminApp() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  normalizarChavePrivada(process.env.FIREBASE_PRIVATE_KEY),
      }),
    });
  }
  return getApps()[0];
}

module.exports = { getFirebaseAdminApp };
