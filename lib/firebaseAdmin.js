// lib/firebaseAdmin.js
// Helper compartilhado pelas funções em api/. Fica FORA da pasta api/ de propósito —
// o Vercel trata todo arquivo dentro de api/ como uma rota pública, e esse aqui não é.

const { initializeApp, cert, getApps } = require('firebase-admin/app');

// Normaliza a chave privada do Firebase mesmo se ela tiver sido colada "achatada"
// numa linha só (perdendo as quebras de linha), o que é um erro comum ao copiar
// esse tipo de valor entre painéis (Netlify → Vercel, por exemplo).
function normalizarChavePrivada(raw) {
  if (!raw) return raw;
  let texto = raw.trim();

  // Extrai só o trecho da chave em si, ignorando QUALQUER coisa ao redor —
  // aspas, texto de tabela markdown, cabeçalhos, múltiplas cópias coladas junto, etc.
  const match = texto.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----\\?n?/);
  if (match) texto = match[0];

  // Converte \n literal (texto escapado) em quebra de linha de verdade
  texto = texto.replace(/\\n/g, '\n');

  // Remove aspas residuais que tenham sobrado nas pontas
  texto = texto.replace(/^"+|"+$/g, '').trim();

  // Se mesmo assim não tiver nenhuma quebra de linha real, a chave foi colada
  // achatada — reconstrói o formato PEM em blocos de 64 caracteres (padrão PEM)
  if (!texto.includes('\n')) {
    const m2 = texto.match(/-----BEGIN PRIVATE KEY-----(.*)-----END PRIVATE KEY-----/);
    if (m2) {
      const corpo = m2[1].replace(/\s/g, '');
      const linhas = corpo.match(/.{1,64}/g) || [];
      texto = `-----BEGIN PRIVATE KEY-----\n${linhas.join('\n')}\n-----END PRIVATE KEY-----\n`;
    }
  }

  if (!texto.endsWith('\n')) texto += '\n';
  return texto;
}

function getFirebaseAdminApp() {
  if (!getApps().length) {
    const normalizada = normalizarChavePrivada(process.env.FIREBASE_PRIVATE_KEY);
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  normalizada,
      }),
    });
  }
  return getApps()[0];
}

module.exports = { getFirebaseAdminApp };
