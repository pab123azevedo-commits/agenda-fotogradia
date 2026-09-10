// api/notificar-solicitacao.js — Vercel Serverless Function
// Mesma lógica de netlify/functions/notificar-solicitacao.js.
// Agora é same-origin (solicitar.html também roda no Vercel), então CORS
// nem seria estritamente necessário, mas mantive por segurança/compatibilidade.

const { getFirebaseAdminApp } = require('../lib/firebaseAdmin');
const { getFirestore }        = require('firebase-admin/firestore');
const { getMessaging }        = require('firebase-admin/messaging');

getFirebaseAdminApp();
const db = getFirestore();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

module.exports = async (req, res) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { uid, nomeCliente, evento, data, hora } = req.body || {};
    console.log('[notificar-solicitacao] chamada recebida', { uid, nomeCliente });

    if (!uid || !nomeCliente) {
      res.status(400).json({ ok: false, erro: 'uid e nomeCliente são obrigatórios' });
      return;
    }

    const userSnap = await db.collection('usuarios').doc(uid).get();
    const tokens = userSnap.data()?.fcmTokens || [];
    console.log('[notificar-solicitacao] usuario encontrado?', userSnap.exists, '| tokens salvos:', tokens.length);

    if (!tokens.length) {
      console.log('[notificar-solicitacao] sem tokens, nada pra enviar');
      res.status(200).json({ ok: true, enviado: false, motivo: 'sem tokens' });
      return;
    }

    const dataFmt = data ? data.split('-').reverse().join('/') : '';
    const corpo = `${nomeCliente} quer agendar${evento ? ' "'+evento+'"' : ''}${dataFmt ? ' para ' + dataFmt : ''}${hora ? ' às ' + hora : ''}`;

    const resp = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: '📩 Nova solicitação de agendamento', body: corpo },
      webpush: { fcmOptions: { link: '/index.html' } }
    });
    console.log('[notificar-solicitacao] resultado do envio:', { sucessos: resp.successCount, falhas: resp.failureCount });
    resp.responses.forEach((r, i) => {
      if (!r.success) console.log('[notificar-solicitacao] falha no token', i, ':', r.error?.code, r.error?.message);
    });

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

    res.status(200).json({ ok: true, enviado: true, sucessos: resp.successCount });
  } catch (err) {
    console.error('Erro em notificar-solicitacao:', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
};
