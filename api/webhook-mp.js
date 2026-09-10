// api/webhook-mp.js — Vercel Serverless Function
// Recebe webhook do Mercado Pago e libera/bloqueia acesso no Firebase automaticamente.
// Lógica idêntica à versão Netlify (netlify/functions/webhook-mp.js) — só o "encaixe"
// muda: Vercel usa (req, res) no estilo Express, não (event, context).

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore }                  = require('firebase-admin/firestore');

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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const body = req.body || {};
    console.log('Webhook MP recebido:', JSON.stringify(body));

    const type   = body.type   || body.action || '';
    const dataId = body.data?.id || body.id;

    if (!dataId) {
      res.status(200).json({ ok: true, msg: 'sem id, ignorado' });
      return;
    }

    if (type === 'subscription_preapproval' || type.includes('preapproval')) {
      await handleAssinatura(dataId);
    } else if (type === 'payment') {
      await handlePagamento(dataId);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro webhook:', err);
    res.status(500).json({ error: err.message });
  }
};

async function handleAssinatura(preapprovalId) {
  const token  = process.env.MP_ACCESS_TOKEN;
  const mpRes  = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const assinatura = await mpRes.json();
  console.log('Assinatura MP:', JSON.stringify(assinatura));

  const uid    = assinatura.external_reference;
  const status = assinatura.status; // authorized | paused | cancelled

  if (!uid) {
    console.log('Sem external_reference — não é possível identificar o usuário');
    return;
  }

  if (status === 'authorized') {
    const vencimento = new Date();
    vencimento.setMonth(vencimento.getMonth() + 1);
    await db.collection('usuarios').doc(uid).update({
      aprovado:        true,
      planoAtivo:      true,
      planoVencimento: vencimento.toISOString(),
      preapprovalId:   preapprovalId,
      ultimoPagamento: new Date().toISOString(),
    });
    console.log(`✅ Acesso liberado para UID: ${uid}`);
  } else if (status === 'paused' || status === 'cancelled') {
    await db.collection('usuarios').doc(uid).update({
      aprovado:   false,
      planoAtivo: false,
    });
    console.log(`🚫 Acesso bloqueado para UID: ${uid} (status: ${status})`);
  }
}

async function handlePagamento(paymentId) {
  const token  = process.env.MP_ACCESS_TOKEN;
  const mpRes  = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const pagamento = await mpRes.json();
  console.log('Pagamento MP:', JSON.stringify(pagamento));

  const uid    = pagamento.external_reference;
  const status = pagamento.status;

  if (!uid) return;

  if (status === 'approved') {
    const vencimento = new Date();
    vencimento.setMonth(vencimento.getMonth() + 1);
    await db.collection('usuarios').doc(uid).update({
      aprovado:        true,
      planoAtivo:      true,
      planoVencimento: vencimento.toISOString(),
      ultimoPagamento: new Date().toISOString(),
    });
    console.log(`✅ Acesso liberado para UID: ${uid}`);
  }
}
