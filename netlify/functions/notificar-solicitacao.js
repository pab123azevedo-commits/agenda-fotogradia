// netlify/functions/notificar-solicitacao.js
// Chamada direto pelo formulário público (solicitar.html) assim que uma solicitação
// é criada — dispara push notification na hora pro fotógrafo, sem precisar esperar
// nenhum horário agendado.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore }                  = require('firebase-admin/firestore');
const { getMessaging }                  = require('firebase-admin/messaging');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  try {
    const { uid, nomeCliente, evento, data, hora } = JSON.parse(event.body || '{}');
    if (!uid || !nomeCliente) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, erro: 'uid e nomeCliente são obrigatórios' }) };
    }

    const userSnap = await db.collection('usuarios').doc(uid).get();
    const tokens = userSnap.data()?.fcmTokens || [];
    if (!tokens.length) {
      // Usuário não ativou push ainda — não é erro, só não tem pra onde mandar
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, enviado: false, motivo: 'sem tokens' }) };
    }

    const dataFmt = data ? data.split('-').reverse().join('/') : '';
    const corpo = `${nomeCliente} quer agendar${evento ? ' "'+evento+'"' : ''}${dataFmt ? ' para ' + dataFmt : ''}${hora ? ' às ' + hora : ''}`;

    const resp = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: '📩 Nova solicitação de agendamento', body: corpo },
      webpush: { fcmOptions: { link: '/index.html' } }
    });

    // Limpa tokens inválidos/expirados encontrados nesse envio
    const tokensInvalidos = [];
    resp.responses.forEach((r, i) => {
      if (!r.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) {
        tokensInvalidos.push(tokens[i]);
      }
    });
    if (tokensInvalidos.length) {
      await db.collection('usuarios').doc(uid).update({
        fcmTokens: tokens.filter(t => !tokensInvalidos.includes(t))
      });
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true, enviado: true, sucessos: resp.successCount }) };
  } catch (err) {
    console.error('Erro em notificar-solicitacao:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ ok: false, erro: err.message }) };
  }
};
