// api/criar-assinatura.js — Vercel Serverless Function
// Lógica idêntica à versão Netlify (netlify/functions/criar-assinatura.js).
// CORS mantido por precaução, mesmo sendo same-origin agora (não atrapalha).

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
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const { uid, nome, email } = req.body || {};

    if (!uid || !email) {
      res.status(400).json({ error: 'uid e email são obrigatórios' });
      return;
    }

    const token = process.env.MP_ACCESS_TOKEN;

    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preapproval_plan_id: '3907e309aeaf4f6c9ce98ab1672f8ba3',
        payer_email: email,
        external_reference: uid,
        back_url: 'https://agenda-fotografia.vercel.app',
      }),
    });

    const data = await response.json();
    console.log('Assinatura criada:', JSON.stringify(data));

    if (data.id) {
      res.status(200).json({ id: data.id, init_point: data.init_point });
    } else {
      res.status(400).json({ error: data.message || 'Erro ao criar assinatura' });
    }
  } catch (err) {
    console.error('Erro criar-assinatura:', err);
    res.status(500).json({ error: err.message });
  }
};
